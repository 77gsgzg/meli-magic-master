import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ML_TOKEN_ENC_KEY = Deno.env.get("ML_TOKEN_ENC_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const jwt = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(jwt);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the order (RLS ensures user can only access their own orders)
    const { data: order, error: orderError } = await supabase
      .from("ml_orders")
      .select("*")
      .eq("id", order_id)
      .eq("user_id", userId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt helper
    const getCryptoKey = async (): Promise<CryptoKey> => {
      const raw = Uint8Array.from(atob(ML_TOKEN_ENC_KEY), (c) => c.charCodeAt(0));
      return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
    };

    const decryptValue = async (value: string | null): Promise<string | null> => {
      if (!value) return null;
      if (!value.startsWith("enc:")) return value;
      try {
        const key = await getCryptoKey();
        const b64 = value.slice(4);
        const binary = atob(b64);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const iv = bytes.slice(0, 12);
        const cipher = bytes.slice(12);
        const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
        return new TextDecoder().decode(plainBuffer);
      } catch (e) {
        console.error("Decryption failed for value:", e);
        return "[Protected]";
      }
    };

    // Decrypt PII fields
    const decryptedOrder = {
      ...order,
      buyer_first_name: await decryptValue(order.buyer_first_name),
      buyer_last_name: await decryptValue(order.buyer_last_name),
      buyer_email: await decryptValue(order.buyer_email),
      buyer_phone: await decryptValue(order.buyer_phone),
      buyer_document_number: await decryptValue(order.buyer_document_number),
      shipping_receiver_name: await decryptValue(order.shipping_receiver_name),
      shipping_address_line: await decryptValue(order.shipping_address_line),
      shipping_address_city: await decryptValue(order.shipping_address_city),
      shipping_address_state: await decryptValue(order.shipping_address_state),
      shipping_address_zip_code: await decryptValue(order.shipping_address_zip_code),
    };

    console.log(`Decrypted PII for order ${order_id} for user ${userId}`);

    return new Response(JSON.stringify({ order: decryptedOrder }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("decrypt-order-pii error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
