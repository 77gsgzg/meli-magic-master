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

    // Rate limiting: 30 requests per minute per user
    const RATE_LIMIT_WINDOW = 60000; // 1 minute
    const RATE_LIMIT_MAX = 30;
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW);
    
    const { data: rateData } = await supabase
      .from('rate_limit_tracking')
      .select('request_count')
      .eq('user_id', userId)
      .eq('endpoint', 'extract-product')
      .gte('window_start', windowStart.toISOString())
      .single();

    if (rateData && rateData.request_count >= RATE_LIMIT_MAX) {
      console.warn(`Rate limit exceeded for user ${userId} on extract-product`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please wait before trying again.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update rate limit counter
    await supabase.from('rate_limit_tracking').upsert({
      user_id: userId,
      endpoint: 'extract-product',
      request_count: (rateData?.request_count || 0) + 1,
      window_start: rateData ? undefined : new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' });

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validateUrl = (urlString: string): { valid: boolean; error?: string } => {
      try {
        const parsed = new URL(urlString);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { valid: false, error: 'Only HTTP/HTTPS protocols are allowed' };
        }

        const host = parsed.hostname.toLowerCase();
        const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
        if (isIp) {
          return { valid: false, error: 'IP addresses are not allowed' };
        }

        const blockedHosts = ['localhost', '127.0.0.1', '169.254.169.254'];
        if (blockedHosts.includes(host)) {
          return { valid: false, error: 'Blocked hostname' };
        }

        if (urlString.length > 2000) {
          return { valid: false, error: 'URL is too long' };
        }

        return { valid: true };
      } catch {
        return { valid: false, error: 'Invalid URL format' };
      }
    };

    const validation = validateUrl(url);
    if (!validation.valid) {
      console.warn('Blocked URL in extract-product:', { url, reason: validation.error });
      await supabase.from('operation_logs').insert({
        user_id: userId,
        operation_type: 'import',
        entity_type: 'extract-product',
        status: 'error',
        error_message: 'Blocked URL in extract-product',
        details: { url, reason: validation.error },
      });
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting product from URL:', url);

    // Try Firecrawl first for JS-rendered content
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    let pageContent = '';
    let screenshotBase64: string | null = null;
    let firecrawlImages: string[] = [];
    let usedFirecrawl = false;

    if (FIRECRAWL_API_KEY) {
      try {
        console.log('Using Firecrawl for JS rendering...');
        const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['html', 'screenshot', 'links'],
            onlyMainContent: false,
            waitFor: 3000,
            location: { country: 'BR', languages: ['pt-BR'] },
          }),
        });

        if (fcResponse.ok) {
          const fcData = await fcResponse.json();
          const content = fcData.data || fcData;
          pageContent = content.html || '';
          screenshotBase64 = content.screenshot || null;
          usedFirecrawl = true;

          // Extract image URLs from links
          if (content.links && Array.isArray(content.links)) {
            firecrawlImages = content.links.filter((link: string) =>
              /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(link)
            ).slice(0, 10);
          }

          console.log(`Firecrawl: ${pageContent.length} chars HTML, screenshot: ${!!screenshotBase64}, images: ${firecrawlImages.length}`);
        } else {
          console.warn('Firecrawl failed, falling back to direct fetch:', fcResponse.status);
        }
      } catch (fcError) {
        console.warn('Firecrawl error, falling back:', fcError);
      }
    }

    // Fallback to direct fetch
    if (!pageContent) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const pageResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        
        if (!pageResponse.ok) {
          throw new Error(`Failed to fetch page: ${pageResponse.status}`);
        }
        
        pageContent = await pageResponse.text();
      } catch (fetchError) {
        console.error('Error fetching URL:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Não foi possível acessar a URL fornecida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Extract basic data from HTML (title, price, description only)
    const extractedData = extractProductData(pageContent, url);

    // Only use images from Firecrawl when it succeeded (status 200).
    // If Firecrawl failed or was unavailable, images stay as empty array (null-safe).
    if (usedFirecrawl && firecrawlImages.length > 0) {
      extractedData.images = firecrawlImages.slice(0, 10);
    } else {
      // Firecrawl failed or unavailable: no images — do not infer from HTML
      extractedData.images = [];
    }

    // If no AI key, return basic extraction
    if (!LOVABLE_API_KEY) {
      console.log('No AI key, returning basic extraction');
      return new Response(
        JSON.stringify({
          ...extractedData,
          ai_enhanced: false,
          firecrawl_enhanced: usedFirecrawl,
          screenshot: screenshotBase64,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use AI to enhance extraction
    const systemPrompt = `Você é um especialista em extrair e analisar dados de produtos de páginas web.
Analise o conteúdo HTML fornecido e extraia as seguintes informações do produto:

1. Título do produto (limpo e descritivo)
2. Descrição completa
3. Preço (valor numérico)
4. Moeda (BRL, USD, etc)
5. Imagens (URLs)
6. Categoria sugerida
7. Características/Atributos principais

Se alguma informação não estiver disponível, retorne null para esse campo.

Responda APENAS em JSON válido com esta estrutura:
{
  "title": "título do produto",
  "description": "descrição completa",
  "price": 199.90,
  "currency": "BRL",
  "images": ["url1", "url2"],
  "category": "categoria sugerida",
  "attributes": [
    {"name": "Cor", "value": "Preto"},
    {"name": "Material", "value": "Alumínio"}
  ]
}`;

    const userPrompt = `URL do produto: ${url}

Dados extraídos automaticamente:
- Título: ${extractedData.title || 'não encontrado'}
- Preço: ${extractedData.price || 'não encontrado'}
- Imagens encontradas: ${extractedData.images?.length || 0}

Conteúdo HTML relevante (primeiros 15000 caracteres):
${pageContent.substring(0, 15000)}

Extraia e organize os dados do produto. Retorne apenas JSON válido.`;

    try {
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
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        console.error('AI API error:', response.status);
        return new Response(
          JSON.stringify({
            ...extractedData,
            ai_enhanced: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content;

      if (content) {
        try {
          const cleanedContent = content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
          const aiData = JSON.parse(cleanedContent);

          // Merge AI data with extracted data
          const finalData = {
            title: aiData.title || extractedData.title,
            description: aiData.description || extractedData.description,
            price: aiData.price || extractedData.price,
            currency: aiData.currency || 'BRL',
            images: aiData.images?.length ? aiData.images : extractedData.images,
            category: aiData.category || extractedData.category,
            attributes: aiData.attributes || [],
            source_url: url,
            ai_enhanced: true,
            firecrawl_enhanced: usedFirecrawl,
            screenshot: screenshotBase64,
          };

          const duration = Date.now() - startTime;
          console.log('Extraction completed in', duration, 'ms');

          // Log operation
          await supabase.from('operation_logs').insert({
            user_id: userId,
            operation_type: 'import',
            entity_type: 'product',
            details: { url, title: finalData.title },
            status: 'success',
            duration_ms: duration,
          });

          return new Response(
            JSON.stringify(finalData),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError);
        }
      }
    } catch (aiError) {
      console.error('AI processing error:', aiError);
    }

    // Fallback to basic extraction
    return new Response(
      JSON.stringify({
        ...extractedData,
        ai_enhanced: false,
        firecrawl_enhanced: usedFirecrawl,
        screenshot: screenshotBase64,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Extract product error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractProductData(html: string, url: string) {
  const data: {
    title: string | null;
    description: string | null;
    price: number | null;
    currency: string;
    images: string[];
    category: string | null;
    source_url: string;
  } = {
    title: null,
    description: null,
    price: null,
    currency: 'BRL',
    images: [],
    category: null,
    source_url: url,
  };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    data.title = titleMatch[1].trim().split('|')[0].split('-')[0].trim();
  }

  // Try og:title
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch) {
    data.title = ogTitleMatch[1].trim();
  }

  // Extract description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) {
    data.description = descMatch[1].trim();
  }

  // Try og:description
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDescMatch) {
    data.description = ogDescMatch[1].trim();
  }

  // Extract price patterns
  const pricePatterns = [
    /R\$\s*([\d.,]+)/gi,
    /"price":\s*"?([\d.,]+)"?/gi,
    /data-price=["']?([\d.,]+)["']?/gi,
    /class=["'][^"']*price[^"']*["'][^>]*>R?\$?\s*([\d.,]+)/gi,
  ];

  for (const pattern of pricePatterns) {
    const match = pattern.exec(html);
    if (match) {
      const priceStr = match[1].replace(/\./g, '').replace(',', '.');
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0 && price < 1000000) {
        data.price = price;
        break;
      }
    }
  }

  // Images are NOT extracted from HTML — only Firecrawl-confirmed URLs are valid.
  // data.images remains [] and will be populated upstream if Firecrawl succeeded.

  return data;
}
