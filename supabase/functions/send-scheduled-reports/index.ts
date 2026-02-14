import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledReport {
  id: string;
  user_id: string;
  name: string;
  webhook_url: string;
  webhook_secret: string | null;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  hour_of_day: number;
  report_type: string;
  is_active: boolean;
  last_sent_at: string | null;
  next_run_at: string | null;
}

interface Product {
  id: string;
  title: string;
  price: number | null;
  status: string | null;
  views: number | null;
  sales: number | null;
  ai_optimized: boolean | null;
  category_name: string | null;
  created_at: string;
  published_at: string | null;
}

interface PublicationHistory {
  id: string;
  status: string;
  created_at: string;
}

function generateSignature(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return hmac.digest("hex");
}

function calculateNextRun(report: ScheduledReport): Date {
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(report.hour_of_day, 0, 0, 0);

  if (report.frequency === "daily") {
    if (now.getHours() >= report.hour_of_day) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  } else if (report.frequency === "weekly" && report.day_of_week !== null) {
    const currentDay = now.getDay();
    let daysUntilTarget = report.day_of_week - currentDay;
    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && now.getHours() >= report.hour_of_day)) {
      daysUntilTarget += 7;
    }
    nextRun.setDate(nextRun.getDate() + daysUntilTarget);
  } else if (report.frequency === "monthly" && report.day_of_month !== null) {
    nextRun.setDate(report.day_of_month);
    if (now.getDate() > report.day_of_month || 
        (now.getDate() === report.day_of_month && now.getHours() >= report.hour_of_day)) {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
  }

  return nextRun;
}

function generateReportData(
  products: Product[],
  history: PublicationHistory[],
  reportType: string
) {
  const stats = {
    total_products: products.length,
    published: products.filter((p) => p.status === "published").length,
    draft: products.filter((p) => p.status === "draft").length,
    pending: products.filter((p) => p.status === "pending").length,
    error: products.filter((p) => p.status === "error").length,
    paused: products.filter((p) => p.status === "paused").length,
    total_views: products.reduce((acc, p) => acc + (p.views || 0), 0),
    total_sales: products.reduce((acc, p) => acc + (p.sales || 0), 0),
    total_revenue: products.reduce(
      (acc, p) => acc + (p.sales || 0) * (p.price || 0),
      0
    ),
    ai_optimized: products.filter((p) => p.ai_optimized).length,
  };

  const conversionRate =
    stats.total_views > 0
      ? ((stats.total_sales / stats.total_views) * 100).toFixed(2)
      : "0";

  // AI vs Manual comparison
  const aiProducts = products.filter((p) => p.ai_optimized);
  const manualProducts = products.filter((p) => !p.ai_optimized);

  const aiStats = {
    count: aiProducts.length,
    published: aiProducts.filter((p) => p.status === "published").length,
    total_views: aiProducts.reduce((acc, p) => acc + (p.views || 0), 0),
    total_sales: aiProducts.reduce((acc, p) => acc + (p.sales || 0), 0),
    total_revenue: aiProducts.reduce(
      (acc, p) => acc + (p.sales || 0) * (p.price || 0),
      0
    ),
  };

  const manualStats = {
    count: manualProducts.length,
    published: manualProducts.filter((p) => p.status === "published").length,
    total_views: manualProducts.reduce((acc, p) => acc + (p.views || 0), 0),
    total_sales: manualProducts.reduce((acc, p) => acc + (p.sales || 0), 0),
    total_revenue: manualProducts.reduce(
      (acc, p) => acc + (p.sales || 0) * (p.price || 0),
      0
    ),
  };

  // Category distribution
  const categories: Record<string, number> = {};
  products.forEach((p) => {
    const cat = p.category_name || "Sem categoria";
    categories[cat] = (categories[cat] || 0) + 1;
  });

  // Top products
  const topProducts = [...products]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 10)
    .map((p) => ({
      title: p.title,
      views: p.views || 0,
      sales: p.sales || 0,
      revenue: (p.sales || 0) * (p.price || 0),
    }));

  // Publication history stats (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentHistory = history.filter(
    (h) => new Date(h.created_at) >= thirtyDaysAgo
  );
  
  const publicationStats = {
    total_attempts: recentHistory.length,
    successful: recentHistory.filter((h) => h.status === "success").length,
    failed: recentHistory.filter((h) => h.status !== "success").length,
  };

  const reportData: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    period: "last_30_days",
  };

  if (reportType === "analytics" || reportType === "all") {
    reportData.overview = {
      ...stats,
      conversion_rate: conversionRate,
    };
    reportData.ai_comparison = {
      ai: aiStats,
      manual: manualStats,
    };
    reportData.publication_stats = publicationStats;
  }

  if (reportType === "products" || reportType === "all") {
    reportData.category_distribution = categories;
    reportData.top_products = topProducts;
  }

  return reportData;
}

async function sendWebhook(
  url: string,
  data: Record<string, unknown>,
  secret: string | null
): Promise<{ success: boolean; status: number; body: string }> {
  const payload = JSON.stringify(data);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret) {
    headers["X-Webhook-Signature"] = generateSignature(payload, secret);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: payload,
    });

    const responseText = await response.text();
    
    return {
      success: response.ok,
      status: response.status,
      body: responseText.substring(0, 1000),
    };
  } catch (error) {
    console.error("Error sending webhook:", error);
    return {
      success: false,
      status: 0,
      body: error instanceof Error ? error.message : "Unknown error",
    };
  }
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

    const now = new Date();
    console.log(`Processing scheduled reports at ${now.toISOString()}`);

    // Get all active reports that are due
    const { data: reports, error: reportsError } = await supabase
      .from("scheduled_reports")
      .select("*")
      .eq("is_active", true)
      .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`);

    if (reportsError) {
      console.error("Error fetching reports:", reportsError);
      throw reportsError;
    }

    console.log(`Found ${reports?.length || 0} reports to process`);

    const results: Array<{ report_id: string; success: boolean; error?: string }> = [];

    for (const report of (reports as ScheduledReport[]) || []) {
      console.log(`Processing report: ${report.name} (${report.id})`);

      try {
        // Fetch user's products
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("id, title, price, status, views, sales, ai_optimized, category_name, created_at, published_at")
          .eq("user_id", report.user_id);

        if (productsError) throw productsError;

        // Fetch publication history
        const { data: history, error: historyError } = await supabase
          .from("publication_history")
          .select("id, status, created_at")
          .eq("user_id", report.user_id);

        if (historyError) throw historyError;

        // Generate report data
        const reportData = generateReportData(
          products || [],
          history || [],
          report.report_type
        );

        // Add metadata
        const webhookPayload = {
          event: "scheduled_report",
          report_name: report.name,
          report_id: report.id,
          frequency: report.frequency,
          data: reportData,
        };

        // Send webhook
        const result = await sendWebhook(
          report.webhook_url,
          webhookPayload,
          report.webhook_secret
        );

        // Log the result
        await supabase.from("report_logs").insert({
          scheduled_report_id: report.id,
          user_id: report.user_id,
          status: result.success ? "success" : "failed",
          response_status: result.status,
          error_message: result.success ? null : result.body,
          report_data: webhookPayload,
        });

        // Update next run time
        const nextRun = calculateNextRun(report);
        await supabase
          .from("scheduled_reports")
          .update({
            last_sent_at: now.toISOString(),
            next_run_at: nextRun.toISOString(),
          })
          .eq("id", report.id);

        results.push({ report_id: report.id, success: result.success });
        console.log(`Report ${report.id} sent: ${result.success ? "success" : "failed"}`);
      } catch (error) {
        console.error(`Error processing report ${report.id}:`, error);
        results.push({
          report_id: report.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-scheduled-reports:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
