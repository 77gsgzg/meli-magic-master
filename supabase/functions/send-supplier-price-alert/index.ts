import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceChange {
  productId: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  supplierUrl: string;
}

interface AlertPayload {
  userId: string;
  email: string;
  priceChanges: PriceChange[];
  threshold: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { userId, email, priceChanges, threshold }: AlertPayload = await req.json();

    console.log(`Sending price alert to ${email} for ${priceChanges.length} changes (threshold: ${threshold}%)`);

    // Filter changes that exceed threshold
    const significantChanges = priceChanges.filter(
      change => Math.abs(change.percentageChange) >= threshold
    );

    if (significantChanges.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: false, message: 'No changes exceed threshold' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log price changes to history
    for (const change of significantChanges) {
      await supabase.from('supplier_price_history').insert({
        supplier_product_id: change.productId,
        user_id: userId,
        old_price: change.oldPrice,
        new_price: change.newPrice,
        price_change_percent: change.percentageChange,
        alert_sent: true,
      });
    }

    // Send email if Resend is configured
    if (RESEND_API_KEY) {
      const resend = new Resend(RESEND_API_KEY);

      const increasedPrices = significantChanges.filter(c => c.percentageChange > 0);
      const decreasedPrices = significantChanges.filter(c => c.percentageChange < 0);

      const formatCurrency = (value: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .alert-card { background: white; border-radius: 8px; padding: 16px; margin: 12px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .price-increase { border-left: 4px solid #ef4444; }
            .price-decrease { border-left: 4px solid #22c55e; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .badge-red { background: #fef2f2; color: #dc2626; }
            .badge-green { background: #f0fdf4; color: #16a34a; }
            .old-price { text-decoration: line-through; color: #9ca3af; }
            .new-price { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;">⚠️ Alerta de Mudança de Preço</h1>
              <p style="margin:8px 0 0;">Detectamos mudanças significativas nos preços do fornecedor</p>
            </div>
            <div class="content">
              <p>Foram detectadas <strong>${significantChanges.length}</strong> mudança(s) de preço que excedem o limite de <strong>${threshold}%</strong>:</p>
              
              ${increasedPrices.length > 0 ? `
                <h3 style="color:#dc2626;">📈 Preços Aumentaram (${increasedPrices.length})</h3>
                ${increasedPrices.map(change => `
                  <div class="alert-card price-increase">
                    <p style="margin:0 0 8px; font-weight:bold;">${change.title}</p>
                    <p style="margin:0;">
                      <span class="old-price">${formatCurrency(change.oldPrice)}</span>
                      → <span class="new-price">${formatCurrency(change.newPrice)}</span>
                      <span class="badge badge-red">+${change.percentageChange.toFixed(1)}%</span>
                    </p>
                  </div>
                `).join('')}
              ` : ''}
              
              ${decreasedPrices.length > 0 ? `
                <h3 style="color:#16a34a;">📉 Preços Diminuíram (${decreasedPrices.length})</h3>
                ${decreasedPrices.map(change => `
                  <div class="alert-card price-decrease">
                    <p style="margin:0 0 8px; font-weight:bold;">${change.title}</p>
                    <p style="margin:0;">
                      <span class="old-price">${formatCurrency(change.oldPrice)}</span>
                      → <span class="new-price">${formatCurrency(change.newPrice)}</span>
                      <span class="badge badge-green">${change.percentageChange.toFixed(1)}%</span>
                    </p>
                  </div>
                `).join('')}
              ` : ''}
              
              <p style="margin-top:24px; padding:16px; background:#e0e7ff; border-radius:8px;">
                💡 <strong>Recomendação:</strong> Acesse o painel de Sincronização de Preços para atualizar seus anúncios no Mercado Livre.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await resend.emails.send({
        from: "Alertas <onboarding@resend.dev>",
        to: [email],
        subject: `⚠️ ${significantChanges.length} mudança(s) de preço detectada(s)`,
        html: emailHtml,
      });

      console.log(`Email sent successfully to ${email}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: true, 
        changesAlerted: significantChanges.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending price alert:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
