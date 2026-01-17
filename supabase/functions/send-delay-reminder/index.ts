import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DelayReminderRequest {
  orderId: string;
  buyerEmail: string;
  buyerName: string;
  itemTitle: string;
  hoursDelayed: number;
  customMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: DelayReminderRequest = await req.json();
    const { orderId, buyerEmail, buyerName, itemTitle, hoursDelayed, customMessage } = body;

    if (!buyerEmail) {
      return new Response(
        JSON.stringify({ error: "Buyer email not available for this order" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const daysDelayed = Math.floor(hoursDelayed / 24);
    const delayText = daysDelayed > 0 
      ? `${daysDelayed} dia(s)` 
      : `${hoursDelayed} hora(s)`;

    const defaultMessage = `
      <h2>Olá ${buyerName || "Cliente"}!</h2>
      <p>Notamos que seu pedido do produto <strong>${itemTitle}</strong> está aguardando envio há <strong>${delayText}</strong>.</p>
      <p>Gostaríamos de informar que estamos trabalhando para despachar seu pedido o mais rápido possível.</p>
      <p>Se tiver qualquer dúvida, por favor entre em contato conosco.</p>
      <br/>
      <p>Atenciosamente,<br/>Equipe de Vendas</p>
    `;

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Loja <onboarding@resend.dev>",
        to: [buyerEmail],
        subject: `Atualização sobre seu pedido - ${itemTitle}`,
        html: customMessage || defaultMessage,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email response:", emailResult);

    if (!emailResponse.ok) {
      throw new Error(emailResult.message || "Failed to send email");
    }

    // Log the operation
    await supabase.from("operation_logs").insert({
      user_id: user.id,
      operation_type: "update",
      entity_type: "order_reminder",
      entity_id: orderId,
      status: "success",
      details: {
        action: "delay_reminder_email",
        buyer_email: buyerEmail,
        hours_delayed: hoursDelayed,
        email_id: emailResult.id,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResult.id,
        message: "Reminder email sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-delay-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
