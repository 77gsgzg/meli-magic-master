import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SavingsSettings = {
  enabled: boolean;
  percent_threshold: number;
  amount_threshold: number;
  lookback_days: number;
  max_opportunities_per_run: number;
};

type SupplierProduct = {
  id: string;
  title: string;
  supplier_name: string;
  price: number;
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ");
}

function hoursAgoIso(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user JWT
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = (await req.json().catch(() => ({}))) as {
      hours_dedupe?: number;
      max_groups?: number;
    };

    const dedupeHours = typeof body.hours_dedupe === "number" ? body.hours_dedupe : 24;

    // Load or initialize settings
    const { data: settingsRow, error: settingsError } = await admin
      .from("supplier_savings_settings")
      .select("enabled, percent_threshold, amount_threshold, lookback_days, max_opportunities_per_run")
      .eq("user_id", userId)
      .maybeSingle();
    if (settingsError) throw settingsError;

    if (!settingsRow) {
      const { error: insertSettingsError } = await admin
        .from("supplier_savings_settings")
        .insert({ user_id: userId });
      if (insertSettingsError) throw insertSettingsError;
    }

    const settings: SavingsSettings = {
      enabled: settingsRow?.enabled ?? true,
      percent_threshold: Number(settingsRow?.percent_threshold ?? 10),
      amount_threshold: Number(settingsRow?.amount_threshold ?? 20),
      lookback_days: Number(settingsRow?.lookback_days ?? 30),
      max_opportunities_per_run: Number(settingsRow?.max_opportunities_per_run ?? 50),
    };

    if (!settings.enabled) {
      return new Response(JSON.stringify({ success: true, inserted: 0, skipped: "disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: products, error: productsError } = await admin
      .from("supplier_products")
      .select("id, title, supplier_name, price")
      .eq("user_id", userId)
      .not("price", "is", null);
    if (productsError) throw productsError;

    const typedProducts: SupplierProduct[] = (products || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      supplier_name: p.supplier_name,
      price: Number(p.price),
    }));

    const groups = new Map<string, SupplierProduct[]>();
    for (const p of typedProducts) {
      const key = normalizeTitle(p.title);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    const candidates: Array<{
      group_key: string;
      representative_title: string;
      cheapest_supplier_name: string;
      cheapest_price: number;
      expensive_supplier_name: string;
      expensive_price: number;
      spread_percent: number;
      spread_amount: number;
      metadata: Record<string, unknown>;
    }> = [];

    for (const [groupKey, list] of groups.entries()) {
      const uniqueSuppliers = new Set(list.map((p) => p.supplier_name));
      if (uniqueSuppliers.size < 2) continue;

      const sorted = [...list].sort((a, b) => a.price - b.price);
      const cheapest = sorted[0];
      const expensive = sorted[sorted.length - 1];
      if (!cheapest || !expensive) continue;
      if (cheapest.price <= 0) continue;

      const spreadAmount = expensive.price - cheapest.price;
      const spreadPercent = (spreadAmount / cheapest.price) * 100;
      const meets =
        spreadPercent >= settings.percent_threshold ||
        spreadAmount >= settings.amount_threshold;
      if (!meets) continue;

      candidates.push({
        group_key: groupKey,
        representative_title: groupKey,
        cheapest_supplier_name: cheapest.supplier_name,
        cheapest_price: cheapest.price,
        expensive_supplier_name: expensive.supplier_name,
        expensive_price: expensive.price,
        spread_percent: Math.round(spreadPercent * 100) / 100,
        spread_amount: Math.round(spreadAmount * 100) / 100,
        metadata: {
          supplier_count: uniqueSuppliers.size,
          product_ids: sorted.map((p) => p.id),
        },
      });
    }

    candidates.sort((a, b) => b.spread_amount - a.spread_amount);

    const maxInsert = typeof body.max_groups === "number"
      ? Math.min(body.max_groups, settings.max_opportunities_per_run)
      : settings.max_opportunities_per_run;

    const toInsert = candidates.slice(0, maxInsert);
    let inserted = 0;

    for (const opp of toInsert) {
      const { data: recent, error: recentError } = await admin
        .from("supplier_savings_opportunities")
        .select("id")
        .eq("user_id", userId)
        .eq("group_key", opp.group_key)
        .eq("cheapest_supplier_name", opp.cheapest_supplier_name)
        .eq("expensive_supplier_name", opp.expensive_supplier_name)
        .gte("detected_at", hoursAgoIso(dedupeHours))
        .limit(1);
      if (recentError) throw recentError;
      if (recent && recent.length > 0) continue;

      const { error: insertError } = await admin
        .from("supplier_savings_opportunities")
        .insert({
          user_id: userId,
          group_key: opp.group_key,
          representative_title: opp.representative_title,
          cheapest_supplier_name: opp.cheapest_supplier_name,
          cheapest_price: opp.cheapest_price,
          expensive_supplier_name: opp.expensive_supplier_name,
          expensive_price: opp.expensive_price,
          spread_percent: opp.spread_percent,
          spread_amount: opp.spread_amount,
          metadata: opp.metadata,
        });
      if (insertError) throw insertError;
      inserted++;
    }

    return new Response(JSON.stringify({ success: true, inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("detect-savings-opportunities error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
