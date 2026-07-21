import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pause-signal',
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

function isBlockedHost(host: string): boolean {
  if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(host)) return true;
  if (host === '169.254.169.254' || host.endsWith('.metadata.google.internal')) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
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

    // Atomic rate limit: 10 batch imports/min. Fail-closed.
    const { data: rl, error: rlErr } = await supabase.rpc('check_and_increment_rate_limit', {
      p_user_id: userId,
      p_endpoint: 'batch-import',
      p_max: 10,
      p_window_seconds: 60,
    });
    if (rlErr) {
      console.error('[rate-limit] RPC error on batch-import (fail-closed):', rlErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit service unavailable. Please retry shortly.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!rl?.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded. Please wait before trying again.', retry_after_seconds: rl?.retry_after_seconds ?? 60 }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl?.retry_after_seconds ?? 60) } }
      );
    }

    const body = await req.json();
    const { urls, resume_log_id, save_progress = true } = body;

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

    // Filter valid URLs with SSRF protection
    const validItems = batchItems.filter(item => {
      try {
        const parsed = new URL(item.url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          item.status = 'error';
          item.error = 'Apenas URLs HTTP/HTTPS são permitidas';
          return false;
        }
        const host = parsed.hostname.toLowerCase();
        if (isBlockedHost(host)) {
          item.status = 'error';
          item.error = 'URL bloqueada';
          return false;
        }
        if (item.url.length > 2000) {
          item.status = 'error';
          item.error = 'URL muito longa';
          return false;
        }
        return true;
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

    // Create or update log entry for progress tracking
    let logId = resume_log_id;
    if (!logId && save_progress) {
      const { data: logEntry, error: logError } = await supabase
        .from('batch_import_logs')
        .insert({
          user_id: userId,
          batch_id: batchId,
          total_urls: urls.length,
          status: 'processing',
          remaining_urls: urls,
          processed_urls: [],
          is_paused: false,
          can_resume: true,
        })
        .select()
        .single();

      if (!logError && logEntry) {
        logId = logEntry.id;
      }
    }

    const processedUrls: string[] = [];
    const remainingUrls: string[] = [...urls];
    let successCount = 0;
    let failedCount = 0;
    let wasPaused = false;

    // Process items sequentially
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      
      // Check if pause was requested by checking the log status
      if (logId && save_progress) {
        const { data: logStatus } = await supabase
          .from('batch_import_logs')
          .select('is_paused')
          .eq('id', logId)
          .single();

        if (logStatus?.is_paused) {
          console.log(`[BATCH-IMPORT] Pause requested at item ${i + 1}/${validItems.length}`);
          wasPaused = true;
          break;
        }
      }

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
          successCount++;
        } else {
          item.status = 'error';
          item.error = result.error || 'Erro desconhecido';
          item.product_id = result.product_id;
          failedCount++;
        }
      } catch (err) {
        item.status = 'error';
        item.error = err instanceof Error ? err.message : 'Erro ao processar';
        failedCount++;
      }

      item.completed_at = new Date().toISOString();

      // Update progress tracking
      processedUrls.push(item.url);
      remainingUrls.shift();

      // Update log with current progress
      if (logId && save_progress) {
        await supabase
          .from('batch_import_logs')
          .update({
            success_count: successCount,
            failed_count: failedCount,
            processed_urls: processedUrls,
            remaining_urls: remainingUrls,
            items: batchItems.filter(bi => bi.status !== 'pending'),
          })
          .eq('id', logId);
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Final update to log
    if (logId && save_progress) {
      await supabase
        .from('batch_import_logs')
        .update({
          success_count: successCount,
          failed_count: failedCount,
          processed_urls: processedUrls,
          remaining_urls: remainingUrls,
          items: batchItems,
          status: wasPaused ? 'paused' : 'complete',
          is_paused: wasPaused,
          can_resume: wasPaused && remainingUrls.length > 0,
          completed_at: wasPaused ? null : new Date().toISOString(),
        })
        .eq('id', logId);
    }

    console.log(`[BATCH-IMPORT] ${wasPaused ? 'Paused' : 'Complete'}: ${successCount} success, ${failedCount} failed, ${remainingUrls.length} remaining`);

    // Trigger batch webhook notification (only if not paused)
    if (!wasPaused) {
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchId,
        log_id: logId,
        total: batchItems.length,
        processed: successCount + failedCount,
        successCount,
        failedCount,
        remainingCount: remainingUrls.length,
        wasPaused,
        canResume: wasPaused && remainingUrls.length > 0,
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
