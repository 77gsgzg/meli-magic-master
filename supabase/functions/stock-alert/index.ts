import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StockAlertRequest {
  products: Array<{
    mlItemId: string;
    title: string;
    availableQuantity: number | null;
    daysOfStock: number | null;
    avgDaily: number;
    suggestedRestock: number;
    trend: string;
  }>;
  criticalDays?: number;
}

// Atomic rate limit via RPC. Fail-closed (email send + external cost).
async function checkRateLimit(supabase: any, userId: string, endpoint: string, maxPerHour: number): Promise<{ ok: boolean; retryAfter?: number; failed?: boolean }> {
  const { data, error } = await supabase.rpc("check_and_increment_rate_limit", {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_max: maxPerHour,
    p_window_seconds: 3600,
  });
  if (error) {
    console.error(`[rate-limit] RPC error on ${endpoint} (fail-closed):`, error);
    return { ok: false, failed: true };
  }
  return { ok: !!data?.allowed, retryAfter: data?.retry_after_seconds };
}

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

    const rlSa = await checkRateLimit(supabase, user.id, "stock-alert", 5);
    if (!rlSa.ok) {
      return new Response(JSON.stringify({ error: rlSa.failed ? "Rate limit service unavailable" : "Rate limit exceeded", retry_after_seconds: rlSa.retryAfter }), {
        status: rlSa.failed ? 503 : 429, headers: { ...corsHeaders, "Content-Type": "application/json", ...(rlSa.retryAfter ? { "Retry-After": String(rlSa.retryAfter) } : {}) },
      });
    }

    const { products, criticalDays = 7 } = (await req.json()) as StockAlertRequest;
    if (!Array.isArray(products)) {
      return new Response(JSON.stringify({ error: "products must be an array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recipient is always the caller's own account email — no arbitrary
    // recipient/from/HTML overrides accepted from the client.
    const recipientEmail = user.email;

    // Filter products with critical stock
    const criticalProducts = products.filter(p => 
      p.daysOfStock !== null && p.daysOfStock < criticalDays
    );

    if (criticalProducts.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No products with critical stock" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trendLabels: Record<string, string> = {
      up: "📈 Alta",
      down: "📉 Baixa",
      stable: "➡️ Estável",
    };

    const productRows = criticalProducts.map(p => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${p.title.slice(0, 50)}${p.title.length > 50 ? '...' : ''}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${p.availableQuantity ?? 0}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="background: ${p.daysOfStock! < 3 ? '#fc8181' : '#f6e05e'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
            ${p.daysOfStock}d
          </span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${p.avgDaily.toFixed(1)}/dia</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${trendLabels[p.trend] || p.trend}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #2d3748;">
          ${p.suggestedRestock}
        </td>
      </tr>
    `).join("");

    const veryUrgent = criticalProducts.filter(p => p.daysOfStock !== null && p.daysOfStock < 3).length;
    const urgent = criticalProducts.filter(p => p.daysOfStock !== null && p.daysOfStock >= 3 && p.daysOfStock < 7).length;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f7fafc; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f56565 0%, #ed8936 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .alert-box { display: flex; gap: 20px; margin: 20px 0; }
    .alert-card { flex: 1; padding: 20px; border-radius: 10px; text-align: center; }
    .alert-critical { background: #fed7d7; }
    .alert-warning { background: #fefcbf; }
    .alert-count { font-size: 36px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #2d3748; color: white; padding: 12px; text-align: left; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Alerta de Estoque Crítico</h1>
      <p>${criticalProducts.length} produto(s) precisam de atenção imediata</p>
    </div>
    <div class="content">
      <div class="alert-box">
        <div class="alert-card alert-critical">
          <p style="margin: 0;">Muito Urgente (&lt;3 dias)</p>
          <p class="alert-count" style="color: #c53030;">${veryUrgent}</p>
        </div>
        <div class="alert-card alert-warning">
          <p style="margin: 0;">Urgente (3-7 dias)</p>
          <p class="alert-count" style="color: #b7791f;">${urgent}</p>
        </div>
      </div>

      <h2>Produtos com Estoque Baixo</h2>
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th style="text-align: center;">Estoque</th>
            <th style="text-align: center;">Dias Restantes</th>
            <th style="text-align: center;">Média Vendas</th>
            <th style="text-align: center;">Tendência</th>
            <th style="text-align: center;">Reabastecer</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
        </tbody>
      </table>

      <p style="background: #e2e8f0; padding: 15px; border-radius: 5px;">
        <strong>💡 Dica:</strong> O valor sugerido de reabastecimento é baseado em uma projeção de 30 dias de estoque, considerando a média de vendas diárias.
      </p>
    </div>
    <div class="footer">
      <p>Este alerta foi gerado automaticamente com base na análise de demanda.</p>
      <p>Data: ${new Date().toLocaleString("pt-BR")}</p>
    </div>
  </div>
</body>
</html>
    `;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Alertas <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: `🚨 Alerta: ${criticalProducts.length} produto(s) com estoque crítico`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errResult = await emailResponse.json();
      throw new Error(errResult.message || "Failed to send email");
    }

    console.log(`Stock alert sent to ${recipientEmail} for ${criticalProducts.length} products`);

    return new Response(JSON.stringify({
      success: true,
      productCount: criticalProducts.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Stock alert error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
