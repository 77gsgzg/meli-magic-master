import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_API_BASE = 'https://api.mercadolibre.com';

interface ExtractedProduct {
  title: string;
  description: string;
  price: number | null;
  currency: string;
  images: string[];
  category: string | null;
  attributes: { name: string; value: string }[];
  source_url: string;
}

interface PublishResult {
  success: boolean;
  step: 'extract' | 'optimize' | 'validate' | 'publish';
  product_id?: string;
  ml_item_id?: string;
  ml_permalink?: string;
  error?: string;
  error_details?: unknown;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let currentStep: PublishResult['step'] = 'extract';
  let savedProductId: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, step: currentStep, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const ML_TOKEN_ENC_KEY = Deno.env.get('ML_TOKEN_ENC_KEY');
    const ML_CLIENT_ID = Deno.env.get('ML_CLIENT_ID');
    const ML_CLIENT_SECRET = Deno.env.get('ML_CLIENT_SECRET');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, step: currentStep, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, step: currentStep, error: 'URL é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTO-PUBLISH] Starting for user ${userId}, URL: ${url}`);

    // ===========================================
    // STEP 1: Validate ML Connection
    // ===========================================
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('ml_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: currentStep, 
          error: 'Conta do Mercado Livre não conectada. Conecte sua conta antes de publicar.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt token helper
    const getCryptoKey = async (): Promise<CryptoKey | null> => {
      if (!ML_TOKEN_ENC_KEY) return null;
      const raw = Uint8Array.from(atob(ML_TOKEN_ENC_KEY), (c) => c.charCodeAt(0));
      return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    };

    const decryptToken = async (value: string): Promise<string> => {
      if (!value.startsWith('enc:')) return value;
      const key = await getCryptoKey();
      if (!key) return value;
      const b64 = value.slice(4);
      const binary = atob(b64);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      const iv = bytes.slice(0, 12);
      const cipher = bytes.slice(12);
      const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
      return new TextDecoder().decode(plainBuffer);
    };

    const encryptToken = async (plain: string): Promise<string> => {
      const key = await getCryptoKey();
      if (!key) return plain;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plain);
      const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded));
      const combined = new Uint8Array(iv.length + cipher.length);
      combined.set(iv, 0);
      combined.set(cipher, iv.length);
      const b64 = btoa(String.fromCharCode(...combined));
      return `enc:${b64}`;
    };

    let accessToken = await decryptToken(tokenRecord.access_token);

    // Check if token needs refresh
    if (new Date(tokenRecord.expires_at) < new Date()) {
      console.log('[AUTO-PUBLISH] Token expired, refreshing...');
      
      const refreshToken = await decryptToken(tokenRecord.refresh_token);
      const refreshResponse = await fetch(`${ML_API_BASE}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: ML_CLIENT_ID!,
          client_secret: ML_CLIENT_SECRET!,
          refresh_token: refreshToken,
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        console.error('[AUTO-PUBLISH] Token refresh failed:', refreshData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            step: currentStep, 
            error: 'Sessão do Mercado Livre expirada. Reconecte sua conta.' 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      accessToken = refreshData.access_token;
      const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

      await supabase
        .from('ml_tokens')
        .update({
          access_token: await encryptToken(accessToken),
          refresh_token: await encryptToken(refreshData.refresh_token),
          expires_at: expiresAt.toISOString(),
        })
        .eq('user_id', userId);
    }

    // ===========================================
    // STEP 2: Extract Product Data
    // ===========================================
    console.log('[AUTO-PUBLISH] Step 1: Extracting product data...');

    // Validate URL
    const validateUrl = (urlString: string): { valid: boolean; error?: string } => {
      try {
        const parsed = new URL(urlString);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { valid: false, error: 'Apenas URLs HTTP/HTTPS são permitidas' };
        }
        const host = parsed.hostname.toLowerCase();
        const blockedHosts = ['localhost', '127.0.0.1', '169.254.169.254'];
        if (blockedHosts.includes(host) || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
          return { valid: false, error: 'URL inválida' };
        }
        return { valid: true };
      } catch {
        return { valid: false, error: 'Formato de URL inválido' };
      }
    };

    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, step: currentStep, error: urlValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch page content
    let pageContent = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

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
        throw new Error(`Erro ao acessar a página: ${pageResponse.status}`);
      }

      pageContent = await pageResponse.text();
    } catch (fetchError) {
      console.error('[AUTO-PUBLISH] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: currentStep, 
          error: 'Não foi possível acessar a URL. Verifique se o link está correto.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract basic product data from HTML
    const extractedData = extractProductData(pageContent, url);

    if (!extractedData.title && !extractedData.images.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: currentStep, 
          error: 'Não foi possível extrair dados do produto. URL pode não ser de um produto válido.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AUTO-PUBLISH] Extracted:', { 
      title: extractedData.title?.substring(0, 50), 
      images: extractedData.images.length,
      price: extractedData.price 
    });

    // ===========================================
    // STEP 3: AI Optimization
    // ===========================================
    currentStep = 'optimize';
    console.log('[AUTO-PUBLISH] Step 2: Optimizing with AI...');

    let optimizedTitle = extractedData.title || 'Produto sem título';
    let optimizedDescription = extractedData.description || '';

    if (LOVABLE_API_KEY && extractedData.title) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `Você otimiza anúncios para Mercado Livre Brasil.
                
REGRAS:
1. Título: máximo 60 caracteres, palavras-chave no início, marca+modelo+características
2. Descrição: benefícios primeiro, bullet points para specs, linguagem persuasiva
3. NUNCA invente informações que não estejam no original
4. NUNCA use "promoção", "oferta", "barato"

Retorne JSON: {"title": "...", "description": "..."}`
              },
              {
                role: 'user',
                content: `Título: ${extractedData.title}
Descrição: ${extractedData.description || 'sem descrição'}
Preço: ${extractedData.price ? `R$ ${extractedData.price}` : 'não informado'}

Otimize para Mercado Livre. Retorne apenas JSON.`
              }
            ],
            temperature: 0.5,
            max_tokens: 1000,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          
          if (content) {
            try {
              const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              const parsed = JSON.parse(cleaned);
              
              if (parsed.title) {
                optimizedTitle = parsed.title.substring(0, 60);
              }
              if (parsed.description) {
                optimizedDescription = parsed.description;
              }
              
              console.log('[AUTO-PUBLISH] AI optimization successful');
            } catch (parseErr) {
              console.warn('[AUTO-PUBLISH] AI parse error, using original data');
            }
          }
        }
      } catch (aiErr) {
        console.warn('[AUTO-PUBLISH] AI error, continuing with original data:', aiErr);
      }
    }

    // Ensure title is within limits
    optimizedTitle = optimizedTitle.substring(0, 60);

    // ===========================================
    // STEP 4: Validate & Prepare for ML
    // ===========================================
    currentStep = 'validate';
    console.log('[AUTO-PUBLISH] Step 3: Validating data...');

    // Validate minimum required data
    if (!optimizedTitle || optimizedTitle.length < 5) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: currentStep, 
          error: 'Título do produto muito curto ou inválido' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!extractedData.price || extractedData.price <= 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: currentStep, 
          error: 'Preço do produto não encontrado ou inválido. É obrigatório para publicação.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!extractedData.images.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: currentStep, 
          error: 'Nenhuma imagem do produto encontrada. É obrigatório ter pelo menos uma imagem.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Predict category from ML API
    let categoryId = 'MLB1000'; // Default category
    try {
      const categoryResponse = await fetch(
        `${ML_API_BASE}/sites/MLB/domain_discovery/search?q=${encodeURIComponent(optimizedTitle)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (categoryResponse.ok) {
        const categoryData = await categoryResponse.json();
        if (categoryData?.[0]?.category_id) {
          categoryId = categoryData[0].category_id;
          console.log('[AUTO-PUBLISH] Predicted category:', categoryId);
        }
      }
    } catch (catErr) {
      console.warn('[AUTO-PUBLISH] Category prediction failed, using default');
    }

    // Save product to database first
    const { data: savedProduct, error: saveError } = await supabase
      .from('products')
      .insert({
        user_id: userId,
        title: optimizedTitle,
        original_title: extractedData.title,
        description: optimizedDescription,
        original_description: extractedData.description,
        price: extractedData.price,
        original_price: extractedData.price,
        currency: extractedData.currency,
        images: extractedData.images,
        category_id: categoryId,
        category_name: extractedData.category,
        attributes: extractedData.attributes,
        source_url: url,
        ai_optimized: !!LOVABLE_API_KEY,
        status: 'pending',
      })
      .select()
      .single();

    if (saveError || !savedProduct) {
      console.error('[AUTO-PUBLISH] Save error:', saveError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: currentStep, 
          error: 'Erro ao salvar produto no banco de dados' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    savedProductId = savedProduct.id;
    console.log('[AUTO-PUBLISH] Product saved:', savedProductId);

    // ===========================================
    // STEP 5: Publish to Mercado Livre
    // ===========================================
    currentStep = 'publish';
    console.log('[AUTO-PUBLISH] Step 4: Publishing to Mercado Livre...');

    const mlItemData = {
      title: optimizedTitle,
      category_id: categoryId,
      price: extractedData.price,
      currency_id: extractedData.currency,
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      condition: 'new',
      listing_type_id: 'gold_special',
      description: { plain_text: optimizedDescription || `${optimizedTitle}. Produto novo e original.` },
      pictures: extractedData.images.slice(0, 10).map((imgUrl: string) => ({ source: imgUrl })),
    };

    console.log('[AUTO-PUBLISH] ML payload:', { 
      title: mlItemData.title, 
      category_id: mlItemData.category_id,
      price: mlItemData.price,
      pictures: mlItemData.pictures.length 
    });

    const publishResponse = await fetch(`${ML_API_BASE}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mlItemData),
    });

    const publishResult = await publishResponse.json();

    if (!publishResponse.ok || !publishResult.id) {
      console.error('[AUTO-PUBLISH] ML API error:', publishResult);

      // Update product with error
      await supabase
        .from('products')
        .update({
          status: 'error',
          error_message: publishResult.message || JSON.stringify(publishResult.cause || publishResult),
        })
        .eq('id', savedProductId);

      // Log publication failure
      await supabase.from('publication_history').insert({
        user_id: userId,
        product_id: savedProductId,
        action: 'auto_publish',
        status: 'error',
        error_details: JSON.stringify(publishResult),
      });

      // Trigger error webhook
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/trigger-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'publish_error',
            user_id: userId,
            data: {
              product_id: savedProductId,
              title: optimizedTitle,
              source_url: url,
              error: publishResult.message || JSON.stringify(publishResult.cause),
            },
          }),
        });
      } catch {}

      const errorMsg = publishResult.cause?.[0]?.message || 
                       publishResult.message || 
                       'Erro retornado pela API do Mercado Livre';

      return new Response(
        JSON.stringify({ 
          success: false, 
          step: currentStep, 
          product_id: savedProductId,
          error: errorMsg,
          error_details: publishResult
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // SUCCESS! Update database
    // ===========================================
    console.log('[AUTO-PUBLISH] SUCCESS! ML Item ID:', publishResult.id);

    await supabase
      .from('products')
      .update({
        status: 'published',
        ml_item_id: publishResult.id,
        ml_permalink: publishResult.permalink,
        published_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', savedProductId);

    // Log success
    await supabase.from('publication_history').insert({
      user_id: userId,
      product_id: savedProductId,
      action: 'auto_publish',
      status: 'success',
      ml_response: publishResult,
    });

    // Log operation
    const duration = Date.now() - startTime;
    await supabase.from('operation_logs').insert({
      user_id: userId,
      operation_type: 'publish',
      entity_id: savedProductId,
      entity_type: 'product',
      details: { 
        source_url: url, 
        ml_item_id: publishResult.id,
        auto_publish: true 
      },
      status: 'success',
      duration_ms: duration,
    });

    // Trigger success webhook
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/trigger-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'publish_success',
          user_id: userId,
          data: {
            product_id: savedProductId,
            ml_item_id: publishResult.id,
            ml_permalink: publishResult.permalink,
            title: optimizedTitle,
            source_url: url,
          },
        }),
      });
    } catch {}

    console.log(`[AUTO-PUBLISH] Complete in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        step: 'publish',
        product_id: savedProductId,
        ml_item_id: publishResult.id,
        ml_permalink: publishResult.permalink,
        title: optimizedTitle,
        price: extractedData.price,
        images_count: extractedData.images.length,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AUTO-PUBLISH] Fatal error:', error);
    
    // Try to update product if we have an ID
    if (savedProductId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('products')
          .update({
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          })
          .eq('id', savedProductId);
      } catch {}
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        step: currentStep,
        product_id: savedProductId,
        error: error instanceof Error ? error.message : 'Erro desconhecido no servidor'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to extract product data from HTML
function extractProductData(html: string, url: string): ExtractedProduct {
  const data: ExtractedProduct = {
    title: '',
    description: '',
    price: null,
    currency: 'BRL',
    images: [],
    category: null,
    attributes: [],
    source_url: url,
  };

  // Extract title - try multiple sources
  const titlePatterns = [
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i,
    /<h1[^>]*>([^<]+)<\/h1>/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ];

  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      data.title = match[1].trim().split('|')[0].split(' - ')[0].trim();
      if (data.title.length > 5) break;
    }
  }

  // Extract description
  const descPatterns = [
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
  ];

  for (const pattern of descPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      data.description = match[1].trim();
      if (data.description.length > 10) break;
    }
  }

  // Extract price - multiple patterns for different sites
  const pricePatterns = [
    /R\$\s*([\d]+[.,][\d]{2})/gi,
    /R\$\s*([\d.,]+)/gi,
    /"price":\s*"?([\d.,]+)"?/gi,
    /"offers"[^}]*"price":\s*"?([\d.,]+)"?/gi,
    /data-price=["']?([\d.,]+)["']?/gi,
    /itemprop=["']price["'][^>]*content=["']?([\d.,]+)["']?/gi,
    /class=["'][^"']*price[^"']*["'][^>]*>R?\$?\s*([\d.,]+)/gi,
  ];

  for (const pattern of pricePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        // Handle Brazilian format (1.234,56) and international (1,234.56)
        let priceStr = match[1].trim();
        // If has comma and 2 digits after, treat as decimal separator
        if (/,\d{2}$/.test(priceStr)) {
          priceStr = priceStr.replace(/\./g, '').replace(',', '.');
        } else {
          priceStr = priceStr.replace(/,/g, '');
        }
        const price = parseFloat(priceStr);
        if (!isNaN(price) && price > 0 && price < 10000000) {
          data.price = Math.round(price * 100) / 100;
          break;
        }
      }
    }
    if (data.price) break;
  }

  // Extract images
  const imagePatterns = [
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi,
    /<meta[^>]*property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["']/gi,
    /"image":\s*"([^"]+)"/gi,
    /"images":\s*\[([^\]]+)\]/gi,
  ];

  const foundImages = new Set<string>();

  for (const pattern of imagePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      if (foundImages.size >= 10) break;
      
      let imgUrl = match[1];
      
      // Handle array of images
      if (imgUrl.includes('"')) {
        const imgMatches = imgUrl.matchAll(/"([^"]+)"/g);
        for (const imgMatch of imgMatches) {
          if (foundImages.size >= 10) break;
          addValidImage(imgMatch[1], foundImages, url);
        }
      } else {
        addValidImage(imgUrl, foundImages, url);
      }
    }
  }

  // Also try to find product images in HTML
  const imgTagPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const imgMatches = html.matchAll(imgTagPattern);
  for (const match of imgMatches) {
    if (foundImages.size >= 10) break;
    addValidImage(match[1], foundImages, url);
  }

  data.images = Array.from(foundImages);

  return data;
}

function addValidImage(imgUrl: string, foundImages: Set<string>, baseUrl: string): void {
  if (!imgUrl) return;
  
  // Make URL absolute
  if (imgUrl.startsWith('//')) {
    imgUrl = 'https:' + imgUrl;
  } else if (imgUrl.startsWith('/')) {
    try {
      const urlObj = new URL(baseUrl);
      imgUrl = urlObj.origin + imgUrl;
    } catch { return; }
  }

  // Filter out invalid images
  const excludePatterns = [
    'icon', 'logo', 'sprite', '.svg', 'pixel', 'tracking', 
    'badge', 'banner', 'avatar', 'user', 'placeholder',
    '1x1', 'spacer', 'blank', 'loading'
  ];

  const lowerUrl = imgUrl.toLowerCase();
  if (!imgUrl.startsWith('http')) return;
  if (excludePatterns.some(p => lowerUrl.includes(p))) return;
  if (imgUrl.length > 2000) return;

  foundImages.add(imgUrl);
}
