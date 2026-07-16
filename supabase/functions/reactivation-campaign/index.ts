import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReactivationBuyer {
  nickname: string;
  email: string;
  daysSinceLastOrder: number;
  tier: string;
  loyaltyScore: number;
  totalRevenue: number;
}
interface ReactivationRequest {
  buyers: ReactivationBuyer[];
}

async function checkRateLimit(supabase: any, userId: string, endpoint: string, maxPerHour: number) {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: row } = await supabase
    .from("rate_limit_tracking")
    .select("id, request_count, window_start")
    .eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (!row || new Date(row.window_start).toISOString() < windowStart) {
    await supabase.from("rate_limit_tracking").upsert(
      { user_id: userId, endpoint, request_count: 1, window_start: new Date().toISOString() },
      { onConflict: "user_id,endpoint" }
    );
    return true;
  }
  if (row.request_count >= maxPerHour) return false;
  await supabase.from("rate_limit_tracking").update({ request_count: row.request_count + 1 }).eq("id", row.id);
  return true;
}

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;").slice(0, 200);

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || !user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(await checkRateLimit(supabase, user.id, "reactivation-campaign", 3))) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { buyers } = (await req.json()) as ReactivationRequest;
    if (!Array.isArray(buyers) || buyers.length === 0) {
      return new Response(JSON.stringify({ error: "No buyers to contact" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hardened: this endpoint no longer accepts arbitrary recipient/from/HTML
    // overrides and no longer relays emails to buyer addresses supplied by the
    // caller (spam/phishing relay risk). Instead we send a single reactivation
    // report to the seller's own account email listing eligible buyers.
    const trimmed = buyers.slice(0, 200);
    const rows = trimmed
      .map(
        (b) => `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${esc(b.nickname)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${esc(b.tier)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${Number(b.daysSinceLastOrder) | 0} dias</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${Number(b.loyaltyScore) | 0}</td>
        </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333">
      <h2>Relatório de Reativação de Compradores</h2>
      <p>${trimmed.length} comprador(es) elegíveis para campanha de reativação.</p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:8px;background:#f7fafc">Comprador</th>
          <th style="text-align:left;padding:8px;background:#f7fafc">Tier</th>
          <th style="text-align:left;padding:8px;background:#f7fafc">Dias sem comprar</th>
          <th style="text-align:left;padding:8px;background:#f7fafc">Loyalty</th>
        </tr></thead><tbody>${rows}</tbody>
      </table>
      <p style="color:#666;font-size:12px;margin-top:16px">Envie campanhas por meio de um serviço de e-mail marketing dedicado.</p>
    </body></html>`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Relatórios <onboarding@resend.dev>",
        to: [user.email],
        subject: `Reativação: ${trimmed.length} comprador(es) elegíveis`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errResult = await emailResponse.json().catch(() => ({}));
      throw new Error(errResult.message || "Failed to send email");
    }

    return new Response(
      JSON.stringify({ success: true, delivered_to: user.email, count: trimmed.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Reactivation campaign error:", error);
    return new Response(JSON.stringify({ error: "Failed to send report" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
