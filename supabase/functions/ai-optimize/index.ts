import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Atomic rate limit: 30 requests per minute per user.
    // Fail-closed: if the RPC errors, we refuse the request because this
    // endpoint burns paid AI credits.
    const { data: rl, error: rlErr } = await supabase.rpc('check_and_increment_rate_limit', {
      p_user_id: userId,
      p_endpoint: 'ai-optimize',
      p_max: 30,
      p_window_seconds: 60,
    });
    if (rlErr) {
      console.error('[rate-limit] RPC error on ai-optimize (fail-closed):', rlErr);
      return new Response(
        JSON.stringify({ error: 'Rate limit service unavailable. Please retry shortly.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!rl?.allowed) {
      console.warn(`Rate limit exceeded for user ${userId} on ai-optimize`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please wait before trying again.', retry_after_seconds: rl?.retry_after_seconds ?? 60 }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl?.retry_after_seconds ?? 60) } }
      );
    }

    const { title, description, category, attributes } = await req.json();

    if (!title) {
      return new Response(
        JSON.stringify({ error: 'Title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Optimizing product with AI:', { title, category });

    const systemPrompt = `Você é um especialista em otimização de anúncios do Mercado Livre Brasil. Sua tarefa é melhorar títulos e descrições de produtos para maximizar visibilidade, cliques e conversões.

Regras para TÍTULOS (máximo 60 caracteres):
- Use palavras-chave relevantes no início
- Inclua marca, modelo e características principais
- Evite caracteres especiais desnecessários
- Não use palavras como "promoção", "oferta", "barato"
- Seja específico e descritivo

Regras para DESCRIÇÕES:
- Comece com os benefícios principais
- Use bullet points para características
- Inclua especificações técnicas
- Adicione informações de garantia e envio se disponíveis
- Use linguagem persuasiva mas honesta
- Mantenha parágrafos curtos e escaneáveis

Responda APENAS em JSON válido com esta estrutura:
{
  "optimized_title": "título otimizado",
  "optimized_description": "descrição otimizada em HTML simples com <br> e <ul><li>",
  "suggested_keywords": ["palavra1", "palavra2", "palavra3"],
  "quality_score": 85,
  "improvements": ["melhoria 1", "melhoria 2"]
}`;

    const userPrompt = `Otimize este produto:

Título original: ${title}
${description ? `Descrição original: ${description}` : ''}
${category ? `Categoria: ${category}` : ''}
${attributes?.length ? `Atributos: ${JSON.stringify(attributes)}` : ''}

Retorne apenas o JSON, sem texto adicional.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error('AI service error');
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty AI response');
    }

    // Parse AI response
    let optimizedData;
    try {
      // Clean the response - remove markdown code blocks if present
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      optimizedData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Fallback: return cleaned title
      optimizedData = {
        optimized_title: title.substring(0, 60),
        optimized_description: description || '',
        suggested_keywords: [],
        quality_score: 50,
        improvements: ['Could not fully optimize'],
      };
    }

    const duration = Date.now() - startTime;

    // Log operation
    await supabase.from('operation_logs').insert({
      user_id: userId,
      operation_type: 'ai_optimization',
      entity_type: 'product',
      details: { original_title: title, optimized_title: optimizedData.optimized_title },
      status: 'success',
      duration_ms: duration,
    });

    console.log('AI optimization completed in', duration, 'ms');

    return new Response(
      JSON.stringify(optimizedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI optimize error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
