import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DownloadResult {
  originalUrl: string;
  storedUrl: string | null;
  success: boolean;
  error?: string;
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0', '::1'].includes(h)) return true;
  if (h === '169.254.169.254' || h.endsWith('.metadata.google.internal')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) {
    const parts = h.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const { imageUrls, productId } = await req.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'imageUrls é obrigatório e deve ser um array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (imageUrls.length > 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Máximo de 10 imagens por vez' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[DOWNLOAD-IMAGES] Starting download for user ${userId}, ${imageUrls.length} images`);

    const results: DownloadResult[] = [];
    const storedUrls: string[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const result: DownloadResult = {
        originalUrl: imageUrl,
        storedUrl: null,
        success: false,
      };

      try {
        // Validate URL
        const parsedUrl = new URL(imageUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          result.error = 'Protocolo inválido';
          results.push(result);
          continue;
        }
        if (isBlockedHost(parsedUrl.hostname.toLowerCase())) {
          result.error = 'Host bloqueado (rede interna)';
          results.push(result);
          continue;
        }

        // Download the image
        console.log(`[DOWNLOAD-IMAGES] Downloading image ${i + 1}/${imageUrls.length}: ${imageUrl.substring(0, 100)}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/*,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          result.error = `Erro ao baixar: HTTP ${response.status}`;
          results.push(result);
          continue;
        }

        // Check content type
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        if (!contentType.startsWith('image/')) {
          result.error = 'Conteúdo não é uma imagem';
          results.push(result);
          continue;
        }

        // Get the image data as ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Check file size (max 10MB)
        if (uint8Array.length > 10 * 1024 * 1024) {
          result.error = 'Imagem muito grande (max 10MB)';
          results.push(result);
          continue;
        }

        // Determine file extension from content type
        let extension = 'jpg';
        if (contentType.includes('png')) {
          extension = 'png';
        } else if (contentType.includes('gif')) {
          extension = 'gif';
        } else if (contentType.includes('webp')) {
          extension = 'webp';
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomId = crypto.randomUUID().substring(0, 8);
        const fileName = `${userId}/${productId || 'temp'}/${timestamp}_${randomId}.${extension}`;

        console.log(`[DOWNLOAD-IMAGES] Uploading to storage: ${fileName} (${uint8Array.length} bytes)`);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, uint8Array, {
            contentType: contentType,
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error(`[DOWNLOAD-IMAGES] Upload error:`, uploadError);
          result.error = `Erro no upload: ${uploadError.message}`;
          results.push(result);
          continue;
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        if (publicUrlData?.publicUrl) {
          result.storedUrl = publicUrlData.publicUrl;
          result.success = true;
          storedUrls.push(publicUrlData.publicUrl);
          console.log(`[DOWNLOAD-IMAGES] Successfully stored: ${publicUrlData.publicUrl}`);
        } else {
          result.error = 'Erro ao obter URL pública';
        }

      } catch (err) {
        console.error(`[DOWNLOAD-IMAGES] Error processing image ${i + 1}:`, err);
        result.error = err instanceof Error ? err.message : 'Erro desconhecido';
      }

      results.push(result);

      // Small delay between downloads to avoid rate limiting
      if (i < imageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`[DOWNLOAD-IMAGES] Complete: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        total: results.length,
        successCount,
        failedCount,
        storedUrls,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DOWNLOAD-IMAGES] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido no servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
