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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { title, category, characteristics, tone } = await req.json();

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Você é um especialista em copywriting para e-commerce, especificamente para o Mercado Livre Brasil.

Gere conteúdo otimizado para maximizar conversões. Responda APENAS em JSON válido:

{
  "generated_title": "Título otimizado (max 60 chars, palavras-chave no início)",
  "short_description": "Descrição curta e impactante (2-3 frases)",
  "long_description": "Descrição detalhada em HTML com <br>, <ul><li>, <strong>. Inclua benefícios, especificações e diferenciais.",
  "benefits": "Lista de benefícios principais separados por |",
  "specifications": "Especificações técnicas formatadas separadas por |",
  "cta": "Call-to-action persuasivo para o anúncio"
}

Regras:
- Nunca use: "promoção", "oferta", "barato", "grátis", "melhor preço"
- Use linguagem persuasiva e profissional
- Inclua palavras-chave relevantes
- Otimize para SEO do Mercado Livre
- Correção ortográfica automática`;

    const userPrompt = `Gere conteúdo completo para este produto:

Título: ${title}
${category ? `Categoria: ${category}` : ''}
${characteristics ? `Características: ${characteristics}` : ''}
${tone ? `Tom desejado: ${tone}` : 'Tom: profissional e persuasivo'}

Retorne apenas o JSON.`;

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
        max_tokens: 3000,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error('AI service error');
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) throw new Error('Empty AI response');

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        generated_title: title.substring(0, 60),
        short_description: '',
        long_description: '',
        benefits: '',
        specifications: '',
        cta: '',
      };
    }

    // Save to database
    const { data: saved, error: saveError } = await supabase
      .from('ai_generated_texts')
      .insert({
        user_id: user.id,
        input_data: { title, category, characteristics, tone },
        generated_title: parsed.generated_title,
        short_description: parsed.short_description,
        long_description: parsed.long_description,
        benefits: parsed.benefits,
        specifications: parsed.specifications,
        cta: parsed.cta,
      })
      .select()
      .single();

    if (saveError) console.error('Save error:', saveError);

    return new Response(JSON.stringify({ ...parsed, id: saved?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI text generation error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
