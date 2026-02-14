import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ML_API_BASE = "https://api.mercadolibre.com";

type MlTokenRow = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  seller_id: string | null;
};

type OrderAlertSettingsRow = {
  user_id: string;
  shipping_delay_alert_enabled: boolean;
  shipping_delay_hours: number;
};

const DEFAULT_ALERTS: Omit<OrderAlertSettingsRow, "user_id"> = {
  shipping_delay_alert_enabled: true,
  shipping_delay_hours: 24,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID")!;
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET")!;
    const ML_TOKEN_ENC_KEY = Deno.env.get("ML_TOKEN_ENC_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Allow only calls with a valid JWT (anon or authenticated).
    const jwt = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(jwt);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Abuse protection: do not run more than once every 10 minutes.
    const { data: lastRun } = await supabase
      .from("cron_job_logs")
      .select("started_at")
      .eq("job_name", "cron_sync_orders")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRun?.started_at) {
      const last = new Date(lastRun.started_at).getTime();
      if (Date.now() - last < 10 * 60 * 1000) {
        return new Response(JSON.stringify({ skipped: true, reason: "cooldown" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const startedAt = new Date().toISOString();
    const { data: jobLog } = await supabase
      .from("cron_job_logs")
      .insert({
        job_name: "cron_sync_orders",
        status: "running",
        started_at: startedAt,
      })
      .select("id")
      .single();

    const jobLogId = jobLog?.id as string | undefined;

    const getCryptoKey = async (): Promise<CryptoKey> => {
      const raw = Uint8Array.from(atob(ML_TOKEN_ENC_KEY), (c) => c.charCodeAt(0));
      return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    };

    const encryptValue = async (plain: string | null): Promise<string | null> => {
      if (!plain) return null;
      const key = await getCryptoKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plain);
      const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded));
      const combined = new Uint8Array(iv.length + cipher.length);
      combined.set(iv, 0);
      combined.set(cipher, iv.length);
      const b64 = btoa(String.fromCharCode(...combined));
      return `enc:${b64}`;
    };

    const encryptToken = encryptValue;

    const decryptValue = async (value: string | null): Promise<string | null> => {
      if (!value) return null;
      if (!value.startsWith("enc:")) return value;
      const key = await getCryptoKey();
      const b64 = value.slice(4);
      const binary = atob(b64);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const iv = bytes.slice(0, 12);
      const cipher = bytes.slice(12);
      const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
      return new TextDecoder().decode(plainBuffer);
    };

    const decryptToken = async (value: string): Promise<string> => {
      const result = await decryptValue(value);
      return result || value;
    };

    // Strip PII from raw API responses before storing
    const sanitizeRawData = (data: any): any => {
      if (!data) return null;
      const clone = JSON.parse(JSON.stringify(data));
      // Remove buyer PII
      if (clone.buyer) {
        delete clone.buyer.email;
        delete clone.buyer.phone;
        delete clone.buyer.first_name;
        delete clone.buyer.last_name;
        delete clone.buyer.billing_info;
        delete clone.buyer.alternative_phone;
      }
      // Remove receiver address PII
      if (clone.receiver_address) {
        delete clone.receiver_address.receiver_name;
        delete clone.receiver_address.receiver_phone;
      }
      // Remove from shipping nested structures
      if (clone.shipping?.receiver_address) {
        delete clone.shipping.receiver_address.receiver_name;
        delete clone.shipping.receiver_address.receiver_phone;
      }
      return clone;
    };

    const refreshAccessToken = async (tokenRow: MlTokenRow) => {
      const decryptedRefresh = await decryptToken(tokenRow.refresh_token);

      const refreshResponse = await fetch(`${ML_API_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: ML_CLIENT_ID,
          client_secret: ML_CLIENT_SECRET,
          refresh_token: decryptedRefresh,
        }),
      });

      const refreshData = await refreshResponse.json();
      if (!refreshResponse.ok) {
        throw new Error(refreshData?.message || "Token refresh failed");
      }

      const newAccess = refreshData.access_token as string;
      const newRefresh = refreshData.refresh_token as string;
      const expiresAt = new Date(Date.now() + Number(refreshData.expires_in) * 1000).toISOString();

      await supabase
        .from("ml_tokens")
        .update({
          access_token: await encryptToken(newAccess),
          refresh_token: await encryptToken(newRefresh),
          expires_at: expiresAt,
        })
        .eq("user_id", tokenRow.user_id);

      return { accessToken: newAccess };
    };

    const { data: tokenRows, error: tokenRowsError } = await supabase
      .from("ml_tokens")
      .select("user_id, access_token, refresh_token, expires_at, seller_id")
      .not("seller_id", "is", null);

    if (tokenRowsError) throw tokenRowsError;

    let totalNewOrders = 0;
    let totalProcessedUsers = 0;
    let totalShippingDelayAlerts = 0;

    for (const row of (tokenRows || []) as MlTokenRow[]) {
      try {
        totalProcessedUsers++;

        // Ensure we have a valid access token.
        let accessToken = await decryptToken(row.access_token);
        const isExpired = new Date(row.expires_at) < new Date();
        if (isExpired) {
          const refreshed = await refreshAccessToken(row);
          accessToken = refreshed.accessToken;
        }

        // Fetch recent paid orders for this seller.
        const ordersResponse = await fetch(
          `${ML_API_BASE}/orders/search?seller=${row.seller_id}&order.status=paid&sort=date_desc&limit=50`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const ordersData = await ordersResponse.json();
        if (!ordersResponse.ok) {
          console.error("Failed to fetch orders for user", row.user_id, ordersData);
          continue;
        }

        const orders = ordersData?.results || [];

        for (const order of orders) {
          const mlOrderId = order?.id?.toString();
          if (!mlOrderId) continue;

          // Check if we already have this order.
          const { data: existingOrder } = await supabase
            .from("ml_orders")
            .select("id")
            .eq("user_id", row.user_id)
            .eq("ml_order_id", mlOrderId)
            .maybeSingle();

          const isNew = !existingOrder?.id;

          // Fetch full order details.
          const orderDetailResponse = await fetch(`${ML_API_BASE}/orders/${mlOrderId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const orderDetail = await orderDetailResponse.json();
          if (!orderDetailResponse.ok) {
            console.error("Failed to fetch order detail", mlOrderId, orderDetail);
            continue;
          }

          // Fetch shipping details if present.
          let shippingData: any = null;
          const shippingId = orderDetail?.shipping?.id || order?.shipping?.id;
          if (shippingId) {
            const shipmentResponse = await fetch(`${ML_API_BASE}/shipments/${shippingId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            shippingData = await shipmentResponse.json();
          }

          const orderItem = orderDetail?.order_items?.[0] || {};
          const buyer = orderDetail?.buyer || {};
          const receiverAddress = shippingData?.receiver_address || {};

          const mlItemId = orderItem?.item?.id?.toString() || "";

          // Match product by ml_item_id.
          const { data: productData } = await supabase
            .from("products")
            .select("id")
            .eq("user_id", row.user_id)
            .eq("ml_item_id", mlItemId)
            .maybeSingle();

          // Encrypt PII fields before storing
          const encryptedBuyerFirstName = await encryptValue(buyer?.first_name || null);
          const encryptedBuyerLastName = await encryptValue(buyer?.last_name || null);
          const encryptedBuyerEmail = await encryptValue(buyer?.email || null);
          const encryptedBuyerPhone = await encryptValue(buyer?.phone?.number || null);
          const encryptedBuyerDocNumber = await encryptValue(buyer?.billing_info?.doc_number || null);
          const encryptedReceiverName = await encryptValue(receiverAddress?.receiver_name || null);
          const addressLine = receiverAddress?.street_name
            ? `${receiverAddress.street_name}, ${receiverAddress.street_number || ""}`
            : null;
          const encryptedAddressLine = await encryptValue(addressLine);
          const encryptedAddressCity = await encryptValue(receiverAddress?.city?.name || null);
          const encryptedAddressState = await encryptValue(receiverAddress?.state?.name || null);
          const encryptedAddressZip = await encryptValue(receiverAddress?.zip_code || null);

          const payload = {
            user_id: row.user_id,
            ml_order_id: mlOrderId,
            ml_pack_id: order?.pack_id?.toString() || null,
            product_id: productData?.id || null,
            status: orderDetail?.status || order?.status || "unknown",
            date_created: orderDetail?.date_created || order?.date_created || new Date().toISOString(),
            date_closed: orderDetail?.date_closed || order?.date_closed || null,
            buyer_id: buyer?.id?.toString() || "",
            buyer_nickname: buyer?.nickname || "Unknown",
            buyer_first_name: encryptedBuyerFirstName,
            buyer_last_name: encryptedBuyerLastName,
            buyer_email: encryptedBuyerEmail,
            buyer_phone: encryptedBuyerPhone,
            buyer_document_number: encryptedBuyerDocNumber,
            shipping_id: shippingId ? shippingId.toString() : null,
            shipping_status: shippingData?.status || null,
            shipping_receiver_name: encryptedReceiverName,
            shipping_address_line: encryptedAddressLine,
            shipping_address_city: encryptedAddressCity,
            shipping_address_state: encryptedAddressState,
            shipping_address_zip_code: encryptedAddressZip,
            shipping_address_country: receiverAddress?.country?.name || null,
            ml_item_id: mlItemId,
            item_title: orderItem?.item?.title || "Unknown Item",
            item_quantity: orderItem?.quantity || 1,
            unit_price: orderItem?.unit_price || 0,
            currency_id: orderItem?.currency_id || "BRL",
            payment_status: orderDetail?.payments?.[0]?.status || null,
            total_amount: orderDetail?.total_amount || order?.total_amount || null,
            tracking_number: shippingData?.tracking_number || null,
            tracking_url: shippingData?.tracking_url || null,
            raw_order_data: sanitizeRawData(orderDetail),
            raw_shipping_data: sanitizeRawData(shippingData),
          };

          const { error: upsertError } = await supabase
            .from("ml_orders")
            .upsert(payload, { onConflict: "ml_order_id" });

          if (upsertError) {
            console.error("Upsert ml_orders failed", mlOrderId, upsertError);
            continue;
          }

          if (payload.product_id) {
            await supabase.from("products").update({ status: "paused" }).eq("id", payload.product_id);
          }

          if (isNew) totalNewOrders++;
        }

        // ========== Shipping delay alert (per user) ==========
        const { data: settingsRow } = await supabase
          .from("order_alert_settings")
          .select("user_id,shipping_delay_alert_enabled,shipping_delay_hours")
          .eq("user_id", row.user_id)
          .maybeSingle();

        const effectiveSettings: OrderAlertSettingsRow = {
          user_id: row.user_id,
          shipping_delay_alert_enabled:
            (settingsRow as any)?.shipping_delay_alert_enabled ?? DEFAULT_ALERTS.shipping_delay_alert_enabled,
          shipping_delay_hours: (settingsRow as any)?.shipping_delay_hours ?? DEFAULT_ALERTS.shipping_delay_hours,
        };

        if (effectiveSettings.shipping_delay_alert_enabled) {
          const thresholdMs = effectiveSettings.shipping_delay_hours * 60 * 60 * 1000;
          const thresholdISO = new Date(Date.now() - thresholdMs).toISOString();

          // Count paid orders older than threshold that are not shipped yet.
          const { count: delayedCount } = await supabase
            .from("ml_orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", row.user_id)
            .eq("status", "paid")
            .is("shipped_at", null)
            .lt("date_created", thresholdISO);

          const count = delayedCount || 0;

          if (count > 0) {
            // Deduplicate: only one alert per user per hour.
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data: recent } = await supabase
              .from("operation_logs")
              .select("id")
              .eq("user_id", row.user_id)
              .gte("created_at", oneHourAgo)
              .contains("details", { action: "shipping_delay_alert" })
              .limit(1);

            if (!recent || recent.length === 0) {
              await supabase.from("operation_logs").insert({
                user_id: row.user_id,
                operation_type: "update",
                entity_type: "ml_orders",
                status: "warning",
                details: {
                  action: "shipping_delay_alert",
                  count,
                  threshold_hours: effectiveSettings.shipping_delay_hours,
                  generated_at: new Date().toISOString(),
                },
              });
              totalShippingDelayAlerts++;
            }
          }
        }
      } catch (e) {
        console.error("Cron sync failed for user", row.user_id, e);
      }
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - start;

    if (jobLogId) {
      await supabase
        .from("cron_job_logs")
        .update({
          status: "success",
          completed_at: completedAt,
          result: {
            processed_users: totalProcessedUsers,
            new_orders: totalNewOrders,
            shipping_delay_alerts: totalShippingDelayAlerts,
            duration_ms: durationMs,
          },
        })
        .eq("id", jobLogId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_users: totalProcessedUsers,
        new_orders: totalNewOrders,
        shipping_delay_alerts: totalShippingDelayAlerts,
        duration_ms: durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("cron-sync-orders error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
