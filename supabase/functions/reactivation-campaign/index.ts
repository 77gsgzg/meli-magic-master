import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReactivationRequest {
  buyers: Array<{
    nickname: string;
    email: string;
    daysSinceLastOrder: number;
    tier: string;
    loyaltyScore: number;
    totalRevenue: number;
  }>;
  fromEmail?: string;
  subject?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { buyers, fromEmail, subject } = await req.json() as ReactivationRequest;

    if (!buyers || buyers.length === 0) {
      return new Response(JSON.stringify({ error: "No buyers to contact" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter buyers with valid emails
    const validBuyers = buyers.filter(b => b.email && b.email.includes("@"));
    
    if (validBuyers.length === 0) {
      return new Response(JSON.stringify({ error: "No buyers with valid emails" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    const tierLabels: Record<string, string> = {
      bronze: "Bronze",
      silver: "Prata",
      gold: "Ouro",
      platinum: "Platina",
    };

    const tierDiscounts: Record<string, string> = {
      bronze: "5%",
      silver: "10%",
      gold: "15%",
      platinum: "20%",
    };

    for (const buyer of validBuyers) {
      try {
        const discount = tierDiscounts[buyer.tier] || "5%";
        const tierLabel = tierLabels[buyer.tier] || "Bronze";

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
    .badge-platinum { background: #9f7aea; color: white; }
    .badge-gold { background: #ecc94b; color: #744210; }
    .badge-silver { background: #a0aec0; color: white; }
    .badge-bronze { background: #ed8936; color: white; }
    .discount-box { background: #48bb78; color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
    .discount-value { font-size: 36px; font-weight: bold; }
    .cta { display: inline-block; background: #667eea; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sentimos sua falta! 💜</h1>
      <p>Olá ${buyer.nickname}!</p>
    </div>
    <div class="content">
      <p>Faz <strong>${buyer.daysSinceLastOrder} dias</strong> desde sua última compra conosco.</p>
      
      <p>Como cliente <span class="badge badge-${buyer.tier}">${tierLabel}</span> com pontuação de fidelidade <strong>${buyer.loyaltyScore}</strong>, você é muito especial para nós!</p>
      
      <div class="discount-box">
        <p style="margin: 0;">Desconto exclusivo para você:</p>
        <p class="discount-value">${discount} OFF</p>
        <p style="margin: 0;">Em todo o catálogo!</p>
      </div>
      
      <p>Não perca essa oportunidade de reabastecer seus produtos favoritos com condições especiais!</p>
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="#" class="cta">Ver Ofertas</a>
      </p>
    </div>
    <div class="footer">
      <p>Este e-mail foi enviado porque você é um cliente valioso.</p>
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
            from: fromEmail || "Loja <onboarding@resend.dev>",
            to: [buyer.email],
            subject: subject || `${buyer.nickname}, sentimos sua falta! 💜 Ganhe ${discount} de desconto`,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errResult = await emailResponse.json();
          throw new Error(errResult.message || "Failed to send email");
        }

        results.sent++;
        console.log(`Email sent to ${buyer.nickname} (${buyer.email})`);
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${buyer.nickname}: ${error.message}`);
        console.error(`Failed to send to ${buyer.nickname}:`, error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Reactivation campaign error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
