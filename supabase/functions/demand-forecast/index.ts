import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductData {
  mlItemId: string;
  title: string;
  totalSold: number;
  avgDaily: number;
  trend: string;
  availableQuantity: number | null;
  daysOfStock: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { products }: { products: ProductData[] } = await req.json();

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ forecasts: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context for AI
    const productSummary = products.slice(0, 15).map((p) => 
      `- ${p.title}: ${p.totalSold} vendidos (${p.avgDaily}/dia), tendência ${p.trend}, estoque: ${p.availableQuantity ?? 'N/A'}, dias de estoque: ${p.daysOfStock ?? 'N/A'}`
    ).join("\n");

    const systemPrompt = `Você é um especialista em previsão de demanda e gestão de estoque para e-commerce.
Analise os dados de vendas dos produtos e forneça recomendações práticas de reabastecimento.
Considere tendências, sazonalidade e níveis de estoque atuais.
Responda em português brasileiro, de forma concisa e acionável.`;

    const userPrompt = `Analise os seguintes produtos e suas métricas de vendas dos últimos 90 dias:

${productSummary}

Para cada produto, forneça:
1. Previsão de demanda para os próximos 30 dias
2. Recomendação de reabastecimento (quantidade sugerida)
3. Prioridade (alta/média/baixa) baseada no risco de ruptura
4. Insight adicional sobre o comportamento de vendas

Formate como uma lista estruturada.`;

    console.log("Calling Lovable AI for demand forecast...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Taxa de requisições excedida. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const forecastText = aiResult.choices?.[0]?.message?.content || "Não foi possível gerar previsão.";

    console.log("Demand forecast generated successfully");

    return new Response(
      JSON.stringify({ 
        forecast: forecastText,
        productsAnalyzed: products.length,
        generatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in demand-forecast:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
