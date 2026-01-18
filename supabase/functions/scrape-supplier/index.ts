import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedProduct {
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  image: string | null;
  url: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { supplierUrl, searchQuery } = await req.json();

    if (!supplierUrl) {
      return new Response(
        JSON.stringify({ error: 'Supplier URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL
    let validatedUrl: URL;
    try {
      validatedUrl = new URL(supplierUrl);
      if (validatedUrl.protocol !== 'http:' && validatedUrl.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping supplier:', supplierUrl);

    // Fetch the page content
    let pageContent = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const pageResponse = await fetch(supplierUrl, {
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
        JSON.stringify({ error: 'Não foi possível acessar o site do fornecedor' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract products using basic HTML parsing
    const basicProducts = extractProductsFromHTML(pageContent, validatedUrl.origin);
    
    console.log('Basic extraction found', basicProducts.length, 'products');

    // If we have AI key, enhance the extraction
    if (LOVABLE_API_KEY && basicProducts.length < 5) {
      try {
        const systemPrompt = `Você é um especialista em extrair produtos de páginas HTML de e-commerce.
Analise o conteúdo HTML fornecido e extraia TODOS os produtos visíveis na página.

Para cada produto encontrado, extraia:
- title: Nome/título do produto
- description: Descrição breve se disponível
- price: Preço numérico (sem moeda)
- currency: Moeda (BRL, USD, etc)
- image: URL completa da imagem principal
- url: URL completa da página do produto

IMPORTANTE:
- Extraia APENAS produtos reais que existem na página
- NÃO invente produtos
- Se não encontrar preço, coloque null
- Converta URLs relativas para absolutas usando a origem: ${validatedUrl.origin}

Responda APENAS em JSON válido com esta estrutura:
{
  "products": [
    {
      "title": "Nome do Produto",
      "description": "Descrição",
      "price": 99.90,
      "currency": "BRL",
      "image": "https://...",
      "url": "https://..."
    }
  ],
  "supplier_name": "Nome do fornecedor",
  "total_found": 10
}`;

        const userPrompt = `URL do fornecedor: ${supplierUrl}
Origem para URLs relativas: ${validatedUrl.origin}

Conteúdo HTML (primeiros 30000 caracteres):
${pageContent.substring(0, 30000)}

Extraia todos os produtos encontrados. Retorne apenas JSON válido.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            temperature: 0.2,
            max_tokens: 4000,
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          const content = aiResult.choices?.[0]?.message?.content;

          if (content) {
            try {
              const cleanedContent = content
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
              const aiData = JSON.parse(cleanedContent);

              if (aiData.products && Array.isArray(aiData.products)) {
                console.log('AI extraction found', aiData.products.length, 'products');
                
                return new Response(
                  JSON.stringify({
                    success: true,
                    products: aiData.products,
                    supplier_name: aiData.supplier_name || extractSupplierName(supplierUrl),
                    total_found: aiData.total_found || aiData.products.length,
                    ai_enhanced: true,
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            } catch (parseError) {
              console.error('Failed to parse AI response:', parseError);
            }
          }
        } else if (aiResponse.status === 429) {
          console.log('AI rate limited, using basic extraction');
        } else if (aiResponse.status === 402) {
          console.log('AI credits exhausted, using basic extraction');
        }
      } catch (aiError) {
        console.error('AI processing error:', aiError);
      }
    }

    // Return basic extraction results
    return new Response(
      JSON.stringify({
        success: true,
        products: basicProducts,
        supplier_name: extractSupplierName(supplierUrl),
        total_found: basicProducts.length,
        ai_enhanced: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scrape supplier error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractSupplierName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch {
    return 'Fornecedor';
  }
}

function extractProductsFromHTML(html: string, origin: string): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];
  const seen = new Set<string>();

  // Look for WooCommerce product patterns
  const wooProductRegex = /<li[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  
  while ((match = wooProductRegex.exec(html)) !== null && products.length < 50) {
    const productHtml = match[1];
    
    // Extract product URL
    const urlMatch = productHtml.match(/<a[^>]*href="([^"]+)"[^>]*>/i);
    const productUrl = urlMatch ? resolveUrl(urlMatch[1], origin) : null;
    
    if (!productUrl || seen.has(productUrl)) continue;
    seen.add(productUrl);

    // Extract title
    const titleMatch = productHtml.match(/<h\d[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([^<]+)<\/h\d>/i)
      || productHtml.match(/<a[^>]*>([^<]+)<\/a>/i)
      || productHtml.match(/title="([^"]+)"/i);
    
    const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : null;
    if (!title) continue;

    // Extract image
    const imgMatch = productHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
    const image = imgMatch ? resolveUrl(imgMatch[1], origin) : null;

    // Extract price
    const priceMatch = productHtml.match(/R\$\s*([\d.,]+)/i)
      || productHtml.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>[^<]*?([\d.,]+)/i);
    
    let price: number | null = null;
    if (priceMatch) {
      const priceStr = priceMatch[1].replace(/\./g, '').replace(',', '.');
      price = parseFloat(priceStr);
      if (isNaN(price)) price = null;
    }

    products.push({
      title,
      description: null,
      price,
      currency: 'BRL',
      image,
      url: productUrl,
    });
  }

  // Generic product patterns if WooCommerce didn't find much
  if (products.length < 5) {
    const genericProductRegex = /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    
    while ((match = genericProductRegex.exec(html)) !== null && products.length < 50) {
      const productHtml = match[1];
      
      const urlMatch = productHtml.match(/<a[^>]*href="([^"]+)"[^>]*>/i);
      const productUrl = urlMatch ? resolveUrl(urlMatch[1], origin) : null;
      
      if (!productUrl || seen.has(productUrl)) continue;
      
      // Skip if URL doesn't look like a product
      if (!productUrl.includes('product') && !productUrl.includes('produto')) continue;
      
      seen.add(productUrl);

      const titleMatch = productHtml.match(/<h\d[^>]*>([^<]+)<\/h\d>/i)
        || productHtml.match(/title="([^"]+)"/i);
      
      const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : null;
      if (!title) continue;

      const imgMatch = productHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
      const image = imgMatch ? resolveUrl(imgMatch[1], origin) : null;

      const priceMatch = productHtml.match(/R\$\s*([\d.,]+)/i);
      let price: number | null = null;
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/\./g, '').replace(',', '.');
        price = parseFloat(priceStr);
        if (isNaN(price)) price = null;
      }

      products.push({
        title,
        description: null,
        price,
        currency: 'BRL',
        image,
        url: productUrl,
      });
    }
  }

  return products;
}

function resolveUrl(url: string, origin: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return origin + url;
  return origin + '/' + url;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
