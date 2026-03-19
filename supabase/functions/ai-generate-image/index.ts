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

    const { style, image_url, record_id } = await req.json();

    if (!style) {
      return new Response(JSON.stringify({ error: 'Style is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stylePrompts: Record<string, string> = {
      white_background: "Product photo on a clean pure white background, professional e-commerce style, high resolution, studio lighting, no shadows, minimalist",
      lifestyle: "Product in a lifestyle setting, natural environment, warm lighting, aspirational scene, professional photography, high quality",
      highlight: "Product with dramatic spotlight, dark gradient background, premium luxury feel, sharp focus, professional product photography",
    };

    const prompt = image_url
      ? `Edit this product image: ${stylePrompts[style] || stylePrompts.white_background}`
      : `Generate a professional product placeholder image: ${stylePrompts[style] || stylePrompts.white_background}`;

    const generatedUrls: string[] = [];

    // Generate 3 variations
    for (let i = 0; i < 3; i++) {
      try {
        const body: any = {
          model: 'google/gemini-3.1-flash-image-preview',
          messages: [
            {
              role: 'user',
              content: image_url
                ? [
                    { type: 'text', text: `${prompt}. Variation ${i + 1} of 3, slightly different angle or composition.` },
                    { type: 'image_url', image_url: { url: image_url } },
                  ]
                : `${prompt}. Variation ${i + 1} of 3.`,
            },
          ],
          modalities: ['image', 'text'],
        };

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (response.ok) {
          const data = await response.json();
          const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (imageData) {
            generatedUrls.push(imageData);
          }
        }
      } catch (e) {
        console.error(`Error generating variation ${i + 1}:`, e);
      }
    }

    // Update the record
    if (record_id) {
      await supabase
        .from('ai_generated_images')
        .update({
          generated_image_urls: generatedUrls,
          status: generatedUrls.length > 0 ? 'completed' : 'error',
        })
        .eq('id', record_id)
        .eq('user_id', user.id);
    }

    return new Response(JSON.stringify({ images: generatedUrls, count: generatedUrls.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI image generation error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
