import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "farmatgu@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
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

    const { action, videoUrl, hashtags, videoId, description, views, likes, comments_count, shares, author_username } = await req.json();

    if (action === "add_video") {
      // Add video to database
      const { data: video, error: insertError } = await supabase
        .from("tiktok_videos")
        .insert({
          user_id: user.id,
          video_url: videoUrl,
          hashtags: hashtags || [],
          description: description || null,
          views: views || 0,
          likes: likes || 0,
          comments_count: comments_count || 0,
          shares: shares || 0,
          author_username: author_username || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, video }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyze") {
      // Fetch video data
      const { data: video, error: fetchError } = await supabase
        .from("tiktok_videos")
        .select("*")
        .eq("id", videoId)
        .single();

      if (fetchError || !video) {
        return new Response(JSON.stringify({ error: "Video not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const prompt = `Analise este vídeo do TikTok e retorne uma análise de potencial para e-commerce.

URL: ${video.video_url}
Descrição: ${video.description || "Não disponível"}
Hashtags: ${(video.hashtags || []).join(", ") || "Nenhuma"}
Views: ${video.views}
Likes: ${video.likes}
Comentários: ${video.comments_count}
Compartilhamentos: ${video.shares}
Autor: ${video.author_username || "Desconhecido"}

Forneça:
1. detected_product: qual produto está sendo mostrado ou promovido (se houver)
2. trend_type: classificação do tipo de conteúdo (problema_resolvido, demonstracao, emocional, viral_hook, review, unboxing, tutorial, outro)
3. potential_score: pontuação de 0 a 10 indicando potencial para venda em e-commerce
4. virality_reason: por que esse vídeo tem potencial viral (1-2 frases)
5. video_summary: resumo do conteúdo do vídeo (2-3 frases)
6. comments_summary: análise estimada do sentimento dos comentários baseado no engajamento`;

      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Você é um analista especializado em tendências do TikTok e e-commerce. Responda sempre usando a ferramenta fornecida.",
              },
              { role: "user", content: prompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "tiktok_analysis",
                  description: "Resultado da análise do vídeo TikTok",
                  parameters: {
                    type: "object",
                    properties: {
                      detected_product: { type: "string" },
                      trend_type: {
                        type: "string",
                        enum: [
                          "problema_resolvido",
                          "demonstracao",
                          "emocional",
                          "viral_hook",
                          "review",
                          "unboxing",
                          "tutorial",
                          "outro",
                        ],
                      },
                      potential_score: { type: "number", minimum: 0, maximum: 10 },
                      virality_reason: { type: "string" },
                      video_summary: { type: "string" },
                      comments_summary: { type: "string" },
                    },
                    required: [
                      "detected_product",
                      "trend_type",
                      "potential_score",
                      "virality_reason",
                      "video_summary",
                      "comments_summary",
                    ],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "tiktok_analysis" },
            },
          }),
        }
      );

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errText);
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Credits exhausted" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let analysis;

      if (toolCall?.function?.arguments) {
        analysis =
          typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
      } else {
        analysis = {
          detected_product: "Não identificado",
          trend_type: "outro",
          potential_score: 5,
          virality_reason: "Análise automática indisponível",
          video_summary: "Não foi possível analisar o vídeo automaticamente",
          comments_summary: "Sem dados",
        };
      }

      // Save analysis
      const { data: savedAnalysis, error: saveError } = await supabase
        .from("tiktok_analysis")
        .insert({
          video_id: videoId,
          user_id: user.id,
          detected_product: analysis.detected_product,
          trend_type: analysis.trend_type,
          potential_score: analysis.potential_score,
          virality_reason: analysis.virality_reason,
          video_summary: analysis.video_summary,
          comments_summary: analysis.comments_summary,
          raw_analysis: analysis,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      return new Response(
        JSON.stringify({ success: true, analysis: savedAnalysis }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "delete_video") {
      const { error } = await supabase
        .from("tiktok_videos")
        .delete()
        .eq("id", videoId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("tiktok-analyze error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
