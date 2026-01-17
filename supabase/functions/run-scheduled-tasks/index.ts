import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("Running scheduled tasks...");

    // Get all active tasks that are due
    const now = new Date();
    const { data: dueTasks, error: fetchError } = await supabase
      .from("scheduled_tasks")
      .select("*")
      .eq("is_active", true)
      .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`);

    if (fetchError) {
      console.error("Error fetching tasks:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${dueTasks?.length || 0} due tasks`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      details: [] as Array<{ taskId: string; type: string; status: string; error?: string }>,
    };

    for (const task of dueTasks || []) {
      try {
        console.log(`Processing task ${task.id} of type ${task.task_type}`);

        const config = task.config as Record<string, any> || {};

        if (task.task_type === "reactivation") {
          // Fetch inactive buyers
          const inactiveDays = config.inactive_days || 30;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

          const { data: orders } = await supabase
            .from("ml_orders")
            .select("buyer_id, buyer_nickname, buyer_email, date_created, total_amount")
            .eq("user_id", task.user_id)
            .order("date_created", { ascending: false });

          // Group by buyer and find inactive ones
          const buyerMap = new Map<string, any>();
          for (const order of orders || []) {
            if (!buyerMap.has(order.buyer_id)) {
              buyerMap.set(order.buyer_id, {
                buyerId: order.buyer_id,
                nickname: order.buyer_nickname,
                email: order.buyer_email,
                lastOrderDate: new Date(order.date_created),
                totalOrders: 1,
                totalRevenue: Number(order.total_amount) || 0,
              });
            } else {
              const buyer = buyerMap.get(order.buyer_id);
              buyer.totalOrders++;
              buyer.totalRevenue += Number(order.total_amount) || 0;
            }
          }

          const inactiveBuyers = Array.from(buyerMap.values())
            .filter(b => b.email && b.lastOrderDate < cutoffDate)
            .map(b => {
              const daysSinceLastOrder = Math.floor((now.getTime() - b.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
              const score = Math.min(100, Math.round(b.totalOrders * 10 + (b.totalRevenue / 100)));
              let tier = "bronze";
              if (score >= 80) tier = "platinum";
              else if (score >= 60) tier = "gold";
              else if (score >= 30) tier = "silver";
              
              return {
                nickname: b.nickname,
                email: b.email,
                daysSinceLastOrder,
                tier,
                loyaltyScore: score,
                totalRevenue: b.totalRevenue,
              };
            });

          if (inactiveBuyers.length > 0) {
            // Send emails
            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            let sent = 0;
            let failed = 0;

            const tierDiscounts: Record<string, string> = {
              bronze: "5%",
              silver: "10%",
              gold: "15%",
              platinum: "20%",
            };

            for (const buyer of inactiveBuyers.slice(0, 50)) { // Limit to 50 per run
              try {
                const discount = tierDiscounts[buyer.tier] || "5%";
                const emailHtml = `
                  <h1>Sentimos sua falta, ${buyer.nickname}!</h1>
                  <p>Faz ${buyer.daysSinceLastOrder} dias desde sua última compra.</p>
                  <p>Como cliente especial, você ganhou <strong>${discount} OFF</strong> em todo o catálogo!</p>
                `;

                const resp = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: "Loja <onboarding@resend.dev>",
                    to: [buyer.email],
                    subject: `${buyer.nickname}, sentimos sua falta! Ganhe ${discount} OFF`,
                    html: emailHtml,
                  }),
                });

                if (resp.ok) sent++;
                else failed++;
              } catch (e) {
                failed++;
              }
            }

            // Log campaign
            await supabase.from("campaign_history").insert({
              user_id: task.user_id,
              campaign_type: "reactivation",
              status: "sent",
              recipients_count: inactiveBuyers.length,
              converted_count: 0,
              details: { sent, failed, inactive_days: inactiveDays },
            });
          }
        } else if (task.task_type === "stock_alert") {
          // Fetch products and orders for demand analysis
          const criticalDays = config.critical_days || 7;
          const alertEmail = config.alert_email;

          if (!alertEmail) {
            throw new Error("No alert email configured");
          }

          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 90);

          const { data: products } = await supabase
            .from("products")
            .select("id, title, ml_item_id, available_quantity")
            .eq("user_id", task.user_id)
            .eq("status", "published");

          const { data: orders } = await supabase
            .from("ml_orders")
            .select("ml_item_id, item_quantity, date_created")
            .eq("user_id", task.user_id)
            .gte("date_created", cutoffDate.toISOString());

          // Calculate demand per product
          const salesMap = new Map<string, number[]>();
          for (const order of orders || []) {
            if (!salesMap.has(order.ml_item_id)) {
              salesMap.set(order.ml_item_id, []);
            }
            salesMap.get(order.ml_item_id)!.push(order.item_quantity);
          }

          const criticalProducts = [];
          for (const product of products || []) {
            if (!product.ml_item_id) continue;
            
            const sales = salesMap.get(product.ml_item_id) || [];
            const totalSales = sales.reduce((a, b) => a + b, 0);
            const avgDaily = totalSales / 90;
            const stock = product.available_quantity || 0;
            const daysOfStock = avgDaily > 0 ? Math.floor(stock / avgDaily) : null;

            if (daysOfStock !== null && daysOfStock < criticalDays) {
              criticalProducts.push({
                mlItemId: product.ml_item_id,
                title: product.title,
                availableQuantity: stock,
                daysOfStock,
                avgDaily,
                suggestedRestock: Math.ceil(avgDaily * 30) - stock,
                trend: "stable",
              });
            }
          }

          if (criticalProducts.length > 0) {
            // Send alert email
            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            
            const productRows = criticalProducts.slice(0, 20).map(p => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${p.title.slice(0, 40)}...</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.availableQuantity}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.daysOfStock}d</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.suggestedRestock}</td>
              </tr>
            `).join("");

            const emailHtml = `
              <h1>⚠️ Alerta de Estoque Crítico</h1>
              <p>${criticalProducts.length} produto(s) com menos de ${criticalDays} dias de estoque.</p>
              <table style="border-collapse: collapse; width: 100%;">
                <thead>
                  <tr style="background: #333; color: white;">
                    <th style="padding: 8px;">Produto</th>
                    <th style="padding: 8px;">Estoque</th>
                    <th style="padding: 8px;">Dias</th>
                    <th style="padding: 8px;">Reabastecer</th>
                  </tr>
                </thead>
                <tbody>${productRows}</tbody>
              </table>
            `;

            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Alertas <onboarding@resend.dev>",
                to: [alertEmail],
                subject: `🚨 ${criticalProducts.length} produto(s) com estoque crítico`,
                html: emailHtml,
              }),
            });

            // Log campaign
            await supabase.from("campaign_history").insert({
              user_id: task.user_id,
              campaign_type: "stock_alert",
              status: "sent",
              recipients_count: 1,
              converted_count: 0,
              details: { product_count: criticalProducts.length, critical_days: criticalDays, alert_email: alertEmail },
            });
          }
        }

        // Calculate next run
        let nextRun = new Date();
        if (task.frequency === "daily") {
          nextRun.setDate(nextRun.getDate() + 1);
          nextRun.setHours(task.hour_of_day, 0, 0, 0);
        } else if (task.frequency === "weekly") {
          nextRun.setDate(nextRun.getDate() + 7);
          nextRun.setHours(task.hour_of_day, 0, 0, 0);
        } else if (task.frequency === "monthly") {
          nextRun.setMonth(nextRun.getMonth() + 1);
          nextRun.setHours(task.hour_of_day, 0, 0, 0);
        }

        // Update task
        await supabase
          .from("scheduled_tasks")
          .update({
            last_run_at: now.toISOString(),
            next_run_at: nextRun.toISOString(),
          })
          .eq("id", task.id);

        results.succeeded++;
        results.details.push({ taskId: task.id, type: task.task_type, status: "success" });
        console.log(`Task ${task.id} completed successfully`);
      } catch (error: any) {
        results.failed++;
        results.details.push({ taskId: task.id, type: task.task_type, status: "failed", error: error.message });
        console.error(`Task ${task.id} failed:`, error);
      }
      results.processed++;
    }

    // Log cron execution
    await supabase.from("cron_job_logs").insert({
      job_name: "run-scheduled-tasks",
      status: results.failed > 0 ? "partial" : "completed",
      result: results,
      completed_at: new Date().toISOString(),
    });

    console.log("Scheduled tasks completed:", results);

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Run scheduled tasks error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
