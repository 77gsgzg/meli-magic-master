import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RetrySettings {
  maxRetries: number;
  retryOlderThanHours: number;
}

// Retry configuration
const MAX_WEBHOOK_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function getRetryDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate authorization
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(jwt);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default settings
    const settings: RetrySettings = {
      maxRetries: 3,
      retryOlderThanHours: 24,
    };

    // Try to parse request body for custom settings
    try {
      const body = await req.json();
      if (body.maxRetries) settings.maxRetries = body.maxRetries;
      if (body.retryOlderThanHours) settings.retryOlderThanHours = body.retryOlderThanHours;
    } catch {
      // Use defaults
    }

    console.log("Starting webhook retry job with settings:", settings);

    // Calculate cutoff time
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - settings.retryOlderThanHours);

    // Fetch failed webhook logs
    const { data: failedLogs, error: logsError } = await supabase
      .from("webhook_logs")
      .select(`
        id,
        webhook_id,
        event_type,
        payload,
        created_at
      `)
      .eq("success", false)
      .neq("event_type", "test")
      .gte("created_at", cutoffTime.toISOString())
      .order("created_at", { ascending: true })
      .limit(100);

    if (logsError) {
      console.error("Error fetching failed logs:", logsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch logs", details: logsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!failedLogs || failedLogs.length === 0) {
      console.log("No failed webhooks to retry");
      return new Response(
        JSON.stringify({ message: "No failed webhooks to retry", processed: 0, success: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${failedLogs.length} failed webhooks to retry`);

    // Get unique webhook IDs
    const webhookIds = [...new Set(failedLogs.map((log) => log.webhook_id))];

    // Fetch active webhooks
    const { data: webhooks, error: webhooksError } = await supabase
      .from("webhooks")
      .select("*")
      .in("id", webhookIds)
      .eq("is_active", true);

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch webhooks" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const activeWebhookMap = new Map(webhooks?.map((w) => [w.id, w]) || []);

    // Track retry counts per log (using payload._meta.attempts)
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const log of failedLogs) {
      const webhook = activeWebhookMap.get(log.webhook_id);
      
      if (!webhook) {
        console.log(`Skipping log ${log.id}: webhook not active or not found`);
        skippedCount++;
        continue;
      }

      // Check attempts from payload
      const previousAttempts = (log.payload as any)?._meta?.attempts || 1;
      if (previousAttempts >= settings.maxRetries) {
        console.log(`Skipping log ${log.id}: max retries (${previousAttempts}) reached`);
        skippedCount++;
        continue;
      }

      // Build the payload for retry
      const payload = {
        event: log.event_type,
        timestamp: new Date().toISOString(),
        data: (log.payload as any)?.data || log.payload,
        _meta: { 
          attempts: previousAttempts + 1,
          original_created_at: log.created_at,
          retry_run: true,
        },
      };

      const result = await triggerWebhookWithRetry(supabase, webhook, payload);
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }

      // Small delay between requests
      await sleep(300);
    }

    const summary = {
      message: "Webhook retry job completed",
      processed: failedLogs.length,
      success: successCount,
      failed: failCount,
      skipped: skippedCount,
      timestamp: new Date().toISOString(),
    };

    console.log("Retry job summary:", summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in retry-webhooks:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function triggerWebhookWithRetry(
  supabase: any,
  webhook: any,
  payload: any
): Promise<{ success: boolean; status?: number; error?: string }> {
  let lastResult: { success: boolean; status?: number; error?: string } = {
    success: false,
    error: "No attempts made",
  };

  for (let attempt = 0; attempt <= MAX_WEBHOOK_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = getRetryDelay(attempt - 1);
      console.log(`Webhook ${webhook.id}: Retry ${attempt}/${MAX_WEBHOOK_RETRIES} after ${delay}ms`);
      await sleep(delay);
    }

    lastResult = await sendWebhook(supabase, webhook, payload, attempt);

    if (lastResult.success) {
      return lastResult;
    }

    // Don't retry on client errors (except 429)
    if (lastResult.status && lastResult.status >= 400 && lastResult.status < 500 && lastResult.status !== 429) {
      break;
    }
  }

  return lastResult;
}

async function sendWebhook(
  supabase: any,
  webhook: any,
  payload: any,
  attempt: number
): Promise<{ success: boolean; status?: number; error?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "MLSyncHub-Webhook/1.0",
    "X-Webhook-Event": payload.event,
    "X-Webhook-Timestamp": payload.timestamp,
    "X-Webhook-Attempt": String(attempt + 1),
    "X-Webhook-Retry": "true",
  };

  if (webhook.secret) {
    const payloadString = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhook.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadString));
    const hexSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    headers["X-Webhook-Signature"] = `sha256=${hexSignature}`;
  }

  let responseStatus: number | undefined;
  let responseBody: string | undefined;
  let success = false;
  let errorMessage: string | undefined;

  try {
    console.log(`[Retry] Sending webhook to ${webhook.url} (attempt ${attempt + 1})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    responseStatus = response.status;
    responseBody = await response.text();
    success = response.ok;

    console.log(`[Retry] Response: ${responseStatus}`);

    if (success) {
      await supabase
        .from("webhooks")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", webhook.id);
    }
  } catch (err: unknown) {
    console.error(`[Retry] Error for webhook ${webhook.id}:`, err);
    if (err instanceof Error) {
      errorMessage = err.name === "AbortError" ? "Request timeout (10s)" : err.message;
    } else {
      errorMessage = "Request failed";
    }
  }

  // Log final attempt
  if (success || attempt >= MAX_WEBHOOK_RETRIES) {
    const logEntry = {
      webhook_id: webhook.id,
      event_type: payload.event,
      payload: payload,
      response_status: responseStatus || null,
      response_body: responseBody?.substring(0, 5000) || errorMessage || null,
      success,
    };

    const { error: logError } = await supabase.from("webhook_logs").insert(logEntry);
    if (logError) {
      console.error("Error logging webhook:", logError);
    }
  }

  return { success, status: responseStatus, error: errorMessage };
}
