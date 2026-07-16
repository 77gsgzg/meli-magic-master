import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAdminClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw { status: 401, message: "Unauthorized" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw { status: 401, message: "Unauthorized" };

  // Rely solely on user_roles.admin — no hardcoded admin email.
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) throw { status: 403, message: "Forbidden" };

  return { supabase, user };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await getAdminClient(req);
    const body = await req.json();
    const { action } = body;

    // === ADD VIDEO (manual) ===
    if (action === "add_video") {
      const { videoUrl, hashtags, description, views, likes, comments_count, shares, author_username } = body;
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
          source: "manual",
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return new Response(JSON.stringify({ success: true, video }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ANALYZE ===
    if (action === "analyze") {
      const { videoId } = body;
      const { data: video, error: fetchError } = await supabase
        .from("tiktok_videos")
        .select("*")
        .eq("id", videoId)
        .single();

      if (fetchError || !video) {
        return new Response(JSON.stringify({ error: "Video not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
2. trend_type: classificação (problema_resolvido, demonstracao, emocional, viral_hook, review, unboxing, tutorial, outro)
3. potential_score: pontuação de 0 a 10 indicando potencial para venda em e-commerce
4. virality_reason: por que esse vídeo tem potencial viral (1-2 frases)
5. video_summary: resumo do conteúdo do vídeo (2-3 frases)
6. comments_summary: análise estimada do sentimento dos comentários`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você é um analista especializado em tendências do TikTok e e-commerce. Responda sempre usando a ferramenta fornecida." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "tiktok_analysis",
              description: "Resultado da análise do vídeo TikTok",
              parameters: {
                type: "object",
                properties: {
                  detected_product: { type: "string" },
                  trend_type: { type: "string", enum: ["problema_resolvido", "demonstracao", "emocional", "viral_hook", "review", "unboxing", "tutorial", "outro"] },
                  potential_score: { type: "number", minimum: 0, maximum: 10 },
                  virality_reason: { type: "string" },
                  video_summary: { type: "string" },
                  comments_summary: { type: "string" },
                },
                required: ["detected_product", "trend_type", "potential_score", "virality_reason", "video_summary", "comments_summary"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "tiktok_analysis" } },
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errText);
        if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let analysis;

      if (toolCall?.function?.arguments) {
        analysis = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
      } else {
        analysis = { detected_product: "Não identificado", trend_type: "outro", potential_score: 5, virality_reason: "Análise automática indisponível", video_summary: "Não foi possível analisar", comments_summary: "Sem dados" };
      }

      const { data: savedAnalysis, error: saveError } = await supabase
        .from("tiktok_analysis")
        .insert({
          video_id: videoId, user_id: user.id,
          detected_product: analysis.detected_product, trend_type: analysis.trend_type,
          potential_score: analysis.potential_score, virality_reason: analysis.virality_reason,
          video_summary: analysis.video_summary, comments_summary: analysis.comments_summary,
          raw_analysis: analysis,
        })
        .select().single();

      if (saveError) throw saveError;

      // Update feed_status
      await supabase.from("tiktok_videos").update({ feed_status: "analyzed" }).eq("id", videoId);

      return new Response(JSON.stringify({ success: true, analysis: savedAnalysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === DELETE VIDEO ===
    if (action === "delete_video") {
      const { error } = await supabase.from("tiktok_videos").delete().eq("id", body.videoId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === UPDATE FEED STATUS (save/ignore) ===
    if (action === "update_feed_status") {
      const { videoId, status } = body;
      const { error } = await supabase.from("tiktok_videos").update({ feed_status: status }).eq("id", videoId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === MARK AS MODEL — extract creative pattern ===
    if (action === "mark_as_model") {
      const { videoId } = body;

      // Check if already a model
      const { data: existingModel } = await supabase
        .from("video_creative_models")
        .select("id")
        .eq("video_id", videoId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingModel) {
        return new Response(JSON.stringify({ success: false, error: "already_model" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get video + analysis
      const { data: video } = await supabase.from("tiktok_videos").select("*").eq("id", videoId).single();
      const { data: analysis } = await supabase.from("tiktok_analysis").select("*").eq("video_id", videoId).maybeSingle();

      if (!video) {
        return new Response(JSON.stringify({ error: "Video not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use AI to extract creative pattern
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const extractPrompt = `Analise a estrutura criativa deste vídeo TikTok e extraia o padrão para reutilização futura.

URL: ${video.video_url}
Descrição: ${video.description || "N/A"}
Views: ${video.views}, Likes: ${video.likes}
${analysis ? `Análise prévia: ${analysis.video_summary || ""}\nTipo: ${analysis.trend_type || ""}` : ""}

Extraia:
1. hook_type: tipo de gancho usado nos primeiros 3s (pergunta, choque, curiosidade, demonstracao, antes_depois, estatistica)
2. opening_style: estilo de abertura (close_up, texto_na_tela, falando_camera, cena_acao, produto_destaque)
3. selling_style: estilo de venda (soft_sell, hard_sell, story_telling, educativo, comparacao, urgencia)
4. pacing: ritmo (rapido, medio, lento, crescente)
5. format: formato (pov, tutorial, review, antes_depois, rotina, desafio, tendencia)
6. structure_summary: descrição breve da estrutura narrativa do vídeo (2-3 frases)
7. tags: array de 3-5 tags descritivas do estilo`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você é especialista em criação de conteúdo viral. Extraia padrões criativos de vídeos. Responda usando a ferramenta fornecida." },
            { role: "user", content: extractPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_creative_model",
              description: "Padrão criativo extraído do vídeo",
              parameters: {
                type: "object",
                properties: {
                  hook_type: { type: "string" },
                  opening_style: { type: "string" },
                  selling_style: { type: "string" },
                  pacing: { type: "string" },
                  format: { type: "string" },
                  structure_summary: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                },
                required: ["hook_type", "opening_style", "selling_style", "pacing", "format", "structure_summary", "tags"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_creative_model" } },
        }),
      });

      if (!aiResp.ok) throw new Error(`AI error: ${aiResp.status}`);

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let pattern;

      if (toolCall?.function?.arguments) {
        pattern = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
      } else {
        pattern = { hook_type: "outro", opening_style: "outro", selling_style: "outro", pacing: "medio", format: "outro", structure_summary: "Extração automática indisponível", tags: [] };
      }

      // Save model
      const { data: model, error: modelError } = await supabase
        .from("video_creative_models")
        .insert({
          user_id: user.id,
          video_id: videoId,
          hook_type: pattern.hook_type,
          opening_style: pattern.opening_style,
          selling_style: pattern.selling_style,
          pacing: pattern.pacing,
          format: pattern.format,
          structure_summary: pattern.structure_summary,
          tags: pattern.tags || [],
          raw_extraction: pattern,
        })
        .select().single();

      if (modelError) throw modelError;

      // Mark video as model
      await supabase.from("tiktok_videos").update({ is_model: true, feed_status: "model" }).eq("id", videoId);

      return new Response(JSON.stringify({ success: true, model }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === AUTO COLLECT (simulated — ready for Apify) ===
    if (action === "auto_collect") {
      const { hashtags: searchHashtags, limit = 20 } = body;

      // Check for APIFY_API_KEY
      const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
      
      if (!APIFY_API_KEY) {
        // Return demo data for now, ready for Apify integration
        const demoVideos = generateDemoFeedVideos(searchHashtags || ["viral", "produto"], limit);
        
        // Insert demo videos avoiding duplicates
        let inserted = 0;
        for (const v of demoVideos) {
          const { data: existing } = await supabase
            .from("tiktok_videos")
            .select("id")
            .eq("video_url", v.video_url)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!existing) {
            await supabase.from("tiktok_videos").insert({ ...v, user_id: user.id, source: "auto_feed" });
            inserted++;
          }
        }

        return new Response(JSON.stringify({ success: true, source: "demo", inserted, total: demoVideos.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Real Apify integration
      try {
        const apifyResponse = await fetch(
          `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              hashtags: searchHashtags || ["viral"],
              resultsPerPage: Math.min(limit, 30),
              shouldDownloadVideos: false,
            }),
          }
        );

        if (!apifyResponse.ok) throw new Error(`Apify error: ${apifyResponse.status}`);
        const apifyData = await apifyResponse.json();

        let inserted = 0;
        for (const item of apifyData) {
          const videoUrl = item.webVideoUrl || item.videoUrl || `https://tiktok.com/@${item.authorMeta?.name}/video/${item.id}`;
          
          const { data: existing } = await supabase
            .from("tiktok_videos")
            .select("id")
            .eq("video_url", videoUrl)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!existing) {
            await supabase.from("tiktok_videos").insert({
              user_id: user.id,
              video_url: videoUrl,
              hashtags: (item.hashtags || []).map((h: any) => h.name || h),
              description: item.text || null,
              views: item.playCount || 0,
              likes: item.diggCount || 0,
              comments_count: item.commentCount || 0,
              shares: item.shareCount || 0,
              author_username: item.authorMeta?.name || null,
              thumbnail_url: item.covers?.default || item.videoMeta?.coverUrl || null,
              source: "apify",
            });
            inserted++;
          }
        }

        return new Response(JSON.stringify({ success: true, source: "apify", inserted, total: apifyData.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (apifyErr) {
        console.error("Apify error:", apifyErr);
        throw apifyErr;
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || (error instanceof Error ? error.message : "Unknown error");
    console.error("tiktok-analyze error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateDemoFeedVideos(hashtags: string[], limit: number) {
  const demoAuthors = ["vendedor_top", "loja_viral", "produto_tendencia", "ecommerce_br", "marketplacepro", "dica_venda", "trend_hunter", "achados_ml"];
  const demoProducts = [
    "Fone Bluetooth TWS", "Luminária LED RGB", "Organizador de Maquiagem",
    "Garrafa Térmica Inteligente", "Suporte Celular Magnético", "Massageador Elétrico",
    "Câmera de Segurança WiFi", "Carregador MagSafe", "Mini Projetor Portátil",
    "Escova Alisadora", "Ring Light Profissional", "Caixa de Som Portátil",
    "Aspirador Robô", "Purificador de Ar", "Balança Digital Corporal",
    "Fritadeira Air Fryer", "Panela Elétrica", "Relógio Smartwatch",
    "Óculos de Sol Polarizado", "Mochila Anti-Furto",
  ];

  const videos = [];
  for (let i = 0; i < Math.min(limit, 20); i++) {
    const author = demoAuthors[Math.floor(Math.random() * demoAuthors.length)];
    const product = demoProducts[i % demoProducts.length];
    const viewsBase = Math.floor(Math.random() * 5000000) + 50000;

    videos.push({
      video_url: `https://tiktok.com/@${author}/video/${Date.now() + i}${Math.floor(Math.random() * 99999)}`,
      hashtags: [...hashtags.slice(0, 3), "fyp", "viral"],
      description: `${product} - O melhor que você vai ver hoje! 🔥 #${hashtags[0] || "viral"}`,
      views: viewsBase,
      likes: Math.floor(viewsBase * (0.03 + Math.random() * 0.12)),
      comments_count: Math.floor(viewsBase * (0.005 + Math.random() * 0.02)),
      shares: Math.floor(viewsBase * (0.002 + Math.random() * 0.01)),
      author_username: author,
      source: "auto_feed",
      thumbnail_url: null,
    });
  }
  return videos;
}
