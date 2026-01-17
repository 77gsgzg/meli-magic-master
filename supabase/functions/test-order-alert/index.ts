import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace("Bearer ", "");

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(jwt);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      threshold_hours?: number;
      simulated_count?: number;
      note?: string;
    };

    const action = body.action || "shipping_delay_alert";
    const thresholdHours = Number.isFinite(Number(body.threshold_hours)) ? Number(body.threshold_hours) : 24;
    const simulatedCount = Number.isFinite(Number(body.simulated_count)) ? Number(body.simulated_count) : 1;

    const details = {
      action: `${action}_test`,
      threshold_hours: thresholdHours,
      count: simulatedCount,
      note: body.note || "Teste manual disparado pelo usuário",
    };

    const { error: insertError } = await supabase.from("operation_logs").insert({
      operation_type: "update",
      status: "info",
      user_id: userId,
      entity_type: "orders",
      entity_id: null,
      details,
      duration_ms: null,
      error_message: null,
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ ok: true, details }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("test-order-alert error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
