import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const WALLET_ADMIN_EMAIL = "farmatgu@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Wallet admin check: must be admin role AND specific email
    if (user.email !== WALLET_ADMIN_EMAIL) {
      // Log unauthorized attempt
      await supabase.from("operation_logs").insert({
        user_id: user.id,
        operation_type: "import", // using existing enum
        status: "error",
        entity_type: "wallet",
        error_message: `Tentativa de acesso não autorizado à wallet por ${user.email}`,
        details: {
          email: user.email,
          endpoint: "wallet-manage",
          blocked_reason: "not_wallet_admin",
        },
      });

      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also verify admin role in DB
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "get_balance": {
        const { data, error } = await supabase
          .from("wallets")
          .select("balance, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        return new Response(JSON.stringify({
          balance: data?.balance ?? 0,
          updated_at: data?.updated_at ?? null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_transactions": {
        const limit = params.limit || 50;
        const offset = params.offset || 0;

        const { data, error, count } = await supabase
          .from("wallet_transactions")
          .select("*", { count: "exact" })
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw error;

        return new Response(JSON.stringify({ transactions: data, total: count }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add_credit": {
        const { amount, description } = params;
        if (!amount || amount <= 0) {
          return new Response(JSON.stringify({ error: "Valor inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase.rpc("wallet_add_credit", {
          p_user_id: user.id,
          p_amount: amount,
          p_description: description || "Crédito manual",
        });

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "process_order_debit": {
        const { order_id } = params;
        if (!order_id) {
          return new Response(JSON.stringify({ error: "order_id obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: order } = await supabase
          .from("ml_orders")
          .select("user_id")
          .eq("id", order_id)
          .single();

        if (!order || order.user_id !== user.id) {
          return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase.rpc("process_order_wallet_debit", {
          p_order_id: order_id,
        });

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("wallet-manage error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
