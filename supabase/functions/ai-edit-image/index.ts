import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atomic rate limit: 20 image edits per minute per user. Fail-closed on RPC error.
    {
      const { data: rl, error: rlErr } = await supabase.rpc('check_and_increment_rate_limit', {
        p_user_id: user.id,
        p_endpoint: 'ai-edit-image',
        p_max: 20,
        p_window_seconds: 60,
      });
      if (rlErr) {
        console.error('[rate-limit] RPC error on ai-edit-image (fail-closed):', rlErr);
        return new Response(JSON.stringify({ error: 'Rate limit service unavailable. Please retry shortly.' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!rl?.allowed) {
        const retry = rl?.retry_after_seconds ?? 60;
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait before trying again.', retry_after_seconds: retry }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retry) },
        });
      }
    }

    const { image_data, prompt, edit_type, record_id } = await req.json();

    if (!image_data || !prompt) {
      return new Response(JSON.stringify({ error: 'Image and prompt are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (prompt.length > 1000) {
      return new Response(JSON.stringify({ error: 'Prompt too long (max 1000 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const editTypePrompts: Record<string, string> = {
      remove_object: "Remove the specified object cleanly from the image, filling the area naturally.",
      add_element: "Add the described element to the image naturally, matching lighting and perspective.",
      change_background: "Change the background of the image as described, keeping the main subject intact.",
      improve_quality: "Enhance the image quality: improve lighting, sharpness, contrast, and color balance.",
      general_adjust: "Apply the described general adjustments to the image while maintaining its essence.",
      custom: "",
    };

    const typePrefix = editTypePrompts[edit_type] || "";
    const fullPrompt = typePrefix ? `${typePrefix} User instruction: ${prompt}` : prompt;

    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.1-flash-image-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: fullPrompt },
                { type: 'image_url', image_url: { url: image_data } },
              ],
            },
          ],
          modalities: ['image', 'text'],
        }),
      });

      if (response.status === 429) {
        if (record_id) {
          await supabase.from('ai_image_edits').update({ status: 'error' }).eq('id', record_id).eq('user_id', user.id);
        }
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        if (record_id) {
          await supabase.from('ai_image_edits').update({ status: 'error' }).eq('id', record_id).eq('user_id', user.id);
        }
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error('AI gateway error:', response.status, errText);
        if (record_id) {
          await supabase.from('ai_image_edits').update({ status: 'error' }).eq('id', record_id).eq('user_id', user.id);
        }
        return new Response(JSON.stringify({ error: 'AI processing failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const editedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (record_id) {
        await supabase.from('ai_image_edits').update({
          edited_image_url: editedImageUrl || null,
          status: editedImageUrl ? 'done' : 'error',
        }).eq('id', record_id).eq('user_id', user.id);
      }

      return new Response(JSON.stringify({ edited_image: editedImageUrl || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('AI call error:', e);
      if (record_id) {
        await supabase.from('ai_image_edits').update({ status: 'error' }).eq('id', record_id).eq('user_id', user.id);
      }
      throw e;
    }
  } catch (error) {
    console.error('AI image edit error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
