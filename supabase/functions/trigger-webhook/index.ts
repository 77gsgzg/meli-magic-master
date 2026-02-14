import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  event_type: string;
  user_id: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

interface TestWebhookPayload {
  webhook_id: string;
  test: boolean;
}

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1 second

// Calculate exponential backoff delay
function getRetryDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt); // 1s, 2s, 4s
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const body = await req.json();
    console.log("Received webhook trigger request:", JSON.stringify(body));

    // Check if this is a test webhook request
    if (body.test && body.webhook_id) {
      return await handleTestWebhook(supabase, body as TestWebhookPayload);
    }

    // Regular webhook trigger
    const { event_type, user_id, data } = body as WebhookPayload;

    if (!event_type || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing event_type or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch active webhooks for this user subscribed to this event
    const { data: webhooks, error: webhooksError } = await supabase
      .from("webhooks")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .contains("events", [event_type]);

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch webhooks" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!webhooks || webhooks.length === 0) {
      console.log(`No active webhooks found for event ${event_type} and user ${user_id}`);
      return new Response(
        JSON.stringify({ message: "No webhooks to trigger", triggered: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${webhooks.length} webhooks to trigger for event ${event_type}`);

    const payload = {
      event: event_type,
      timestamp: new Date().toISOString(),
      data: data || {},
    };

    // Trigger all webhooks in parallel with retry
    const results = await Promise.allSettled(
      webhooks.map((webhook) => triggerWebhookWithRetry(supabase, webhook, payload))
    );

    const successCount = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failCount = results.length - successCount;

    console.log(`Webhook trigger complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        message: "Webhooks triggered",
        total: webhooks.length,
        success: successCount,
        failed: failCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in trigger-webhook:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleTestWebhook(supabase: any, body: TestWebhookPayload) {
  console.log(`Testing webhook ${body.webhook_id}`);

  // Fetch the webhook
  const { data: webhook, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", body.webhook_id)
    .maybeSingle();

  if (error || !webhook) {
    console.error("Webhook not found:", error);
    return new Response(
      JSON.stringify({ error: "Webhook not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const testPayload = {
    event: "test",
    timestamp: new Date().toISOString(),
    data: {
      message: "This is a test webhook from ML Sync Hub",
      webhook_id: webhook.id,
      webhook_name: webhook.name,
    },
  };

  // For test, no retry - just single attempt
  const result = await triggerWebhook(supabase, webhook, testPayload, true, 0);

  return new Response(
    JSON.stringify({
      success: result.success,
      status: result.status,
      response: result.response,
      message: result.success
        ? "Test webhook sent successfully!"
        : `Test failed: ${result.error || "Unknown error"}`,
    }),
    {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Wrapper with exponential backoff retry
async function triggerWebhookWithRetry(
  supabase: any,
  webhook: any,
  payload: any
): Promise<{ success: boolean; status?: number; response?: string; error?: string; attempts: number }> {
  let lastResult: { success: boolean; status?: number; response?: string; error?: string } = {
    success: false,
    error: "No attempts made",
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = getRetryDelay(attempt - 1);
      console.log(`Webhook ${webhook.id}: Retry attempt ${attempt}/${MAX_RETRIES} after ${delay}ms delay`);
      await sleep(delay);
    }

    lastResult = await triggerWebhook(supabase, webhook, payload, false, attempt);

    if (lastResult.success) {
      console.log(`Webhook ${webhook.id}: Success on attempt ${attempt + 1}`);
      return { ...lastResult, attempts: attempt + 1 };
    }

    // Check if we should retry based on status code
    // Don't retry on 4xx errors (client errors) except 429 (rate limit)
    if (lastResult.status && lastResult.status >= 400 && lastResult.status < 500 && lastResult.status !== 429) {
      console.log(`Webhook ${webhook.id}: Not retrying due to client error ${lastResult.status}`);
      break;
    }
  }

  console.log(`Webhook ${webhook.id}: Failed after ${MAX_RETRIES + 1} attempts`);
  return { ...lastResult, attempts: MAX_RETRIES + 1 };
}

async function triggerWebhook(
  supabase: any,
  webhook: any,
  payload: any,
  isTest = false,
  attempt = 0
): Promise<{ success: boolean; status?: number; response?: string; error?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "MLSyncHub-Webhook/1.0",
    "X-Webhook-Event": payload.event,
    "X-Webhook-Timestamp": payload.timestamp,
    "X-Webhook-Attempt": String(attempt + 1),
  };

  // Add HMAC signature if secret is configured
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
    console.log(`Sending webhook to ${webhook.url} (attempt ${attempt + 1})`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

    console.log(`Webhook response: ${responseStatus} - ${responseBody.substring(0, 200)}`);

    // Update last_triggered_at on success
    if (success) {
      await supabase
        .from("webhooks")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", webhook.id);
    }
  } catch (err: unknown) {
    console.error(`Error triggering webhook ${webhook.id}:`, err);
    if (err instanceof Error) {
      errorMessage = err.message || "Request failed";
      if (err.name === "AbortError") {
        errorMessage = "Request timeout (10s)";
      }
    } else {
      errorMessage = "Request failed";
    }
  }

  // Only log on final attempt or success (to avoid spamming logs during retries)
  const shouldLog = isTest || success || attempt >= MAX_RETRIES;
  
  if (shouldLog) {
    const logEntry = {
      webhook_id: webhook.id,
      event_type: isTest ? "test" : payload.event,
      payload: {
        ...payload,
        _meta: { attempts: attempt + 1 },
      },
      response_status: responseStatus || null,
      response_body: responseBody?.substring(0, 5000) || errorMessage || null,
      success,
    };

    const { error: logError } = await supabase.from("webhook_logs").insert(logEntry);
    if (logError) {
      console.error("Error logging webhook:", logError);
    }
  }

  return {
    success,
    status: responseStatus,
    response: responseBody?.substring(0, 500),
    error: errorMessage,
  };
}
