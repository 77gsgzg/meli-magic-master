import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StaleImport {
  id: string;
  batch_id: string;
  user_id: string;
  total_urls: number;
  success_count: number;
  failed_count: number;
  started_at: string;
  remaining_urls: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Find imports paused for more than 24 hours
    const { data: staleImports, error: fetchError } = await supabase
      .from('batch_import_logs')
      .select('id, batch_id, user_id, total_urls, success_count, failed_count, started_at, remaining_urls')
      .eq('is_paused', true)
      .eq('can_resume', true)
      .lt('started_at', twentyFourHoursAgo.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!staleImports || staleImports.length === 0) {
      return new Response(
        JSON.stringify({ message: "No stale imports found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by user to send one notification per user
    const userImportsMap = new Map<string, StaleImport[]>();
    for (const imp of staleImports as StaleImport[]) {
      const existing = userImportsMap.get(imp.user_id) || [];
      existing.push(imp);
      userImportsMap.set(imp.user_id, existing);
    }

    const notificationResults: { user_id: string; success: boolean; error?: string }[] = [];

    for (const [userId, imports] of userImportsMap.entries()) {
      try {
        // Get user preferences to check if they want notifications
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('notify_import_error')
          .eq('user_id', userId)
          .single();

        // Default to true if no preference set
        const shouldNotify = prefs?.notify_import_error !== false;

        if (shouldNotify) {
          // Get webhooks that subscribe to import_error events
          const { data: webhooks } = await supabase
            .from('webhooks')
            .select('id, url, secret')
            .eq('user_id', userId)
            .eq('is_active', true)
            .contains('events', ['import_error']);

          if (webhooks && webhooks.length > 0) {
            // Trigger webhook for stale import notification
            for (const webhook of webhooks) {
              const payload = {
                event: 'stale_import_alert',
                timestamp: new Date().toISOString(),
                data: {
                  count: imports.length,
                  imports: imports.map(imp => ({
                    id: imp.id,
                    batch_id: imp.batch_id,
                    total_urls: imp.total_urls,
                    success_count: imp.success_count,
                    failed_count: imp.failed_count,
                    remaining: (imp.remaining_urls || []).length,
                    hours_paused: Math.round((Date.now() - new Date(imp.started_at).getTime()) / (1000 * 60 * 60)),
                  })),
                },
              };

              try {
                const headers: Record<string, string> = {
                  'Content-Type': 'application/json',
                };

                if (webhook.secret) {
                  const encoder = new TextEncoder();
                  const key = await crypto.subtle.importKey(
                    'raw',
                    encoder.encode(webhook.secret),
                    { name: 'HMAC', hash: 'SHA-256' },
                    false,
                    ['sign']
                  );
                  const signature = await crypto.subtle.sign(
                    'HMAC',
                    key,
                    encoder.encode(JSON.stringify(payload))
                  );
                  headers['X-Webhook-Signature'] = btoa(String.fromCharCode(...new Uint8Array(signature)));
                }

                const response = await fetch(webhook.url, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(payload),
                });

                // Log the webhook delivery
                await supabase.from('webhook_logs').insert({
                  webhook_id: webhook.id,
                  event_type: 'stale_import_alert',
                  payload,
                  response_status: response.status,
                  response_body: await response.text().catch(() => null),
                  success: response.ok,
                });
              } catch (webhookError) {
                console.error(`Error sending webhook to ${webhook.url}:`, webhookError);
                await supabase.from('webhook_logs').insert({
                  webhook_id: webhook.id,
                  event_type: 'stale_import_alert',
                  payload,
                  response_status: 0,
                  response_body: webhookError instanceof Error ? webhookError.message : 'Unknown error',
                  success: false,
                });
              }
            }
          }
        }

        notificationResults.push({ user_id: userId, success: true });
      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError);
        notificationResults.push({
          user_id: userId,
          success: false,
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Stale import check completed",
        stale_count: staleImports.length,
        users_notified: notificationResults.filter(r => r.success).length,
        results: notificationResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-stale-imports:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
