import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchItem {
  url: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  product_id?: string;
  ml_item_id?: string;
  ml_permalink?: string;
  title?: string;
  price?: number;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

interface BatchResult {
  batch_id: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  items: BatchItem[];
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
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lista de URLs é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Max 20 URLs per batch
    if (urls.length > 20) {
      return new Response(
        JSON.stringify({ success: false, error: 'Máximo de 20 URLs por lote' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BATCH-IMPORT] Starting batch import for user ${userId}, ${urls.length} URLs`);

    const batchId = crypto.randomUUID();
    const batchItems: BatchItem[] = urls.map((url: string) => ({
      url: url.trim(),
      status: 'pending' as const,
    }));

    // Filter valid URLs
    const validItems = batchItems.filter(item => {
      try {
        const parsed = new URL(item.url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        item.status = 'error';
        item.error = 'URL inválida';
        return false;
      }
    });

    if (validItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhuma URL válida encontrada',
          batch_id: batchId,
          items: batchItems
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process items sequentially to avoid rate limiting
    const processItem = async (item: BatchItem): Promise<void> => {
      item.status = 'processing';
      item.started_at = new Date().toISOString();

      try {
        // Call auto-publish for each URL
        const response = await fetch(`${SUPABASE_URL}/functions/v1/auto-publish`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: item.url }),
        });

        const result = await response.json();

        if (result.success) {
          item.status = 'success';
          item.product_id = result.product_id;
          item.ml_item_id = result.ml_item_id;
          item.ml_permalink = result.ml_permalink;
          item.title = result.title;
          item.price = result.price;
        } else {
          item.status = 'error';
          item.error = result.error || 'Erro desconhecido';
          item.product_id = result.product_id;
        }
      } catch (err) {
        item.status = 'error';
        item.error = err instanceof Error ? err.message : 'Erro ao processar';
      }

      item.completed_at = new Date().toISOString();
    };

    // Process all items (sequentially to respect ML rate limits)
    for (const item of validItems) {
      await processItem(item);
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Calculate stats
    const successCount = batchItems.filter(i => i.status === 'success').length;
    const failedCount = batchItems.filter(i => i.status === 'error').length;

    console.log(`[BATCH-IMPORT] Complete: ${successCount} success, ${failedCount} failed`);

    // Trigger batch webhook notification
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/trigger-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'batch_import_complete',
          user_id: userId,
          data: {
            batch_id: batchId,
            total: batchItems.length,
            success: successCount,
            failed: failedCount,
            items: batchItems.map(i => ({
              url: i.url,
              status: i.status,
              ml_item_id: i.ml_item_id,
              title: i.title,
              error: i.error,
            })),
          },
        }),
      });
    } catch {}

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchId,
        total: batchItems.length,
        processed: successCount + failedCount,
        successCount: successCount,
        failedCount: failedCount,
        items: batchItems,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BATCH-IMPORT] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido no servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
