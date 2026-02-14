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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate authorization
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const jwt = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(jwt);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[SCHEDULED-IMPORTS] Checking for due imports...');

    const now = new Date();

    // Find all scheduled imports that are due
    const { data: dueImports, error: fetchError } = await supabase
      .from('scheduled_batch_imports')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now.toISOString());

    if (fetchError) {
      console.error('[SCHEDULED-IMPORTS] Error fetching:', fetchError);
      throw fetchError;
    }

    console.log(`[SCHEDULED-IMPORTS] Found ${dueImports?.length || 0} due imports`);

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const schedule of dueImports || []) {
      console.log(`[SCHEDULED-IMPORTS] Processing schedule: ${schedule.name} (${schedule.id})`);

      try {
        // Get user's ML token
        const { data: tokenData } = await supabase
          .from('ml_tokens')
          .select('access_token')
          .eq('user_id', schedule.user_id)
          .single();

        if (!tokenData?.access_token) {
          console.log(`[SCHEDULED-IMPORTS] No ML token for user ${schedule.user_id}`);
          results.push({ id: schedule.id, success: false, error: 'No ML token' });
          continue;
        }

        // Create batch import log
        const batchId = crypto.randomUUID();
        const { data: logEntry } = await supabase
          .from('batch_import_logs')
          .insert({
            user_id: schedule.user_id,
            scheduled_import_id: schedule.id,
            batch_id: batchId,
            total_urls: schedule.urls.length,
            status: 'processing',
          })
          .select()
          .single();

        // Process each URL
        let successCount = 0;
        let failedCount = 0;
        const items: Array<{ url: string; status: string; error?: string; ml_item_id?: string }> = [];

        for (const url of schedule.urls) {
          try {
            // Get user auth token for the batch-import call
            // We need to make internal call to auto-publish
            const response = await fetch(`${SUPABASE_URL}/functions/v1/auto-publish`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'x-user-id': schedule.user_id,
              },
              body: JSON.stringify({ url, internal_call: true, user_id: schedule.user_id }),
            });

            const result = await response.json();

            if (result.success) {
              successCount++;
              items.push({ url, status: 'success', ml_item_id: result.ml_item_id });
            } else {
              failedCount++;
              items.push({ url, status: 'error', error: result.error });
            }
          } catch (err) {
            failedCount++;
            items.push({ url, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Update log entry
        if (logEntry?.id) {
          await supabase
            .from('batch_import_logs')
            .update({
              success_count: successCount,
              failed_count: failedCount,
              items,
              status: 'complete',
              completed_at: new Date().toISOString(),
            })
            .eq('id', logEntry.id);
        }

        // Calculate next run
        const nextRun = calculateNextRun(schedule);

        // Update schedule
        await supabase
          .from('scheduled_batch_imports')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun,
          })
          .eq('id', schedule.id);

        results.push({ id: schedule.id, success: true });
        console.log(`[SCHEDULED-IMPORTS] Completed: ${successCount} success, ${failedCount} failed`);

      } catch (err) {
        console.error(`[SCHEDULED-IMPORTS] Error processing schedule ${schedule.id}:`, err);
        results.push({ 
          id: schedule.id, 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SCHEDULED-IMPORTS] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateNextRun(schedule: {
  frequency: string;
  hour_of_day: number;
  day_of_week: number | null;
  day_of_month: number | null;
}): string {
  const now = new Date();
  let nextRun = new Date();
  nextRun.setMinutes(0, 0, 0);
  nextRun.setHours(schedule.hour_of_day);

  switch (schedule.frequency) {
    case 'daily':
      nextRun.setDate(nextRun.getDate() + 1);
      break;

    case 'weekly':
      nextRun.setDate(nextRun.getDate() + 1);
      const targetDay = schedule.day_of_week ?? 1;
      while (nextRun.getDay() !== targetDay) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'monthly':
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(Math.min(schedule.day_of_month ?? 1, 28));
      break;

    default:
      nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun.toISOString();
}
