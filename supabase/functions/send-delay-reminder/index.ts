import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DelayReminderRequest {
  orderId: string;
}

// Basic per-user rate limit using rate_limit_tracking.
async function checkRateLimit(
  supabase: any,
  userId: string,
  endpoint: string,
  maxPerHour: number
): Promise<{ ok: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: row } = await supabase
    .from("rate_limit_tracking")
    .select("id, request_count, window_start")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (!row || new Date(row.window_start).toISOString() < windowStart) {
    await supabase
      .from("rate_limit_tracking")
      .upsert(
        { user_id: userId, endpoint, request_count: 1, window_start: new Date().toISOString() },
        { onConflict: "user_id,endpoint" }
      );
    return { ok: true, remaining: maxPerHour - 1 };
  }

  if (row.request_count >= maxPerHour) return { ok: false, remaining: 0 };

  await supabase
    .from("rate_limit_tracking")
    .update({ request_count: row.request_count + 1 })
    .eq("id", row.id);
  return { ok: true, remaining: maxPerHour - row.request_count - 1 };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Rate limit: max 10 delay reminders per hour per user.
    const rl = await checkRateLimit(supabase, user.id, "send-delay-reminder", 10);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { orderId } = (await req.json()) as DelayReminderRequest;
    if (!orderId || typeof orderId !== "string") {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify ownership + decrypt PII server-side via decrypt-order-pii function
    const { data: order, error: orderErr } = await supabase
      .from("ml_orders")
      .select("id, user_id, item_title, date_created")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch decrypted buyer info via the internal decryption function (which
    // itself enforces ownership + admin logging).
    const decryptResp = await supabase.functions.invoke("decrypt-order-pii", {
      body: { orderId: order.id },
      headers: { Authorization: authHeader },
    });
    const buyerEmail: string | null = decryptResp?.data?.buyer_email || null;
    const buyerName: string = decryptResp?.data?.buyer_first_name || "Cliente";

    if (!buyerEmail || !buyerEmail.includes("@")) {
      return new Response(JSON.stringify({ error: "Buyer email not available for this order" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const hoursDelayed = Math.max(
      0,
      Math.floor((Date.now() - new Date(order.date_created).getTime()) / (1000 * 60 * 60))
    );
    const daysDelayed = Math.floor(hoursDelayed / 24);
    const delayText = daysDelayed > 0 ? `${daysDelayed} dia(s)` : `${hoursDelayed} hora(s)`;

    // Server-generated template only — no caller-supplied HTML.
    const html = `
      <h2>Olá ${escapeHtml(buyerName)}!</h2>
      <p>Notamos que seu pedido do produto <strong>${escapeHtml(order.item_title || "")}</strong> está aguardando envio há <strong>${delayText}</strong>.</p>
      <p>Estamos trabalhando para despachar seu pedido o mais rápido possível.</p>
      <p>Se tiver qualquer dúvida, entre em contato conosco.</p>
      <br/><p>Atenciosamente,<br/>Equipe de Vendas</p>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Loja <onboarding@resend.dev>",
        to: [buyerEmail],
        subject: `Atualização sobre seu pedido - ${order.item_title || ""}`.slice(0, 200),
        html,
      }),
    });

    const emailResult = await emailResponse.json();
    if (!emailResponse.ok) throw new Error(emailResult.message || "Failed to send email");

    await supabase.from("operation_logs").insert({
      user_id: user.id,
      operation_type: "update",
      entity_type: "order_reminder",
      entity_id: orderId,
      status: "success",
      details: { action: "delay_reminder_email", hours_delayed: hoursDelayed, email_id: emailResult.id },
    });

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-delay-reminder:", error);
    return new Response(JSON.stringify({ error: "Failed to send reminder" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
