import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_API_BASE = 'https://api.mercadolibre.com';

// Rate limit tracking
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 50; // requests per window

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ML_TOKEN_ENC_KEY = Deno.env.get('ML_TOKEN_ENC_KEY');

    if (!ML_TOKEN_ENC_KEY) {
      console.error('ML_TOKEN_ENC_KEY not configured - refusing to handle ML tokens without encryption');
      return new Response(
        JSON.stringify({ error: 'Mercado Livre token encryption is not configured. Please contact o administrador do sistema.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const getCryptoKey = async (): Promise<CryptoKey> => {
      const raw = Uint8Array.from(atob(ML_TOKEN_ENC_KEY), (c) => c.charCodeAt(0));
      return crypto.subtle.importKey(

        'raw',
        raw,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    };

    const encryptToken = async (plain: string): Promise<string> => {
      const key = await getCryptoKey();
      if (!key) return plain;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plain);
      const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded));
      const combined = new Uint8Array(iv.length + cipher.length);
      combined.set(iv, 0);
      combined.set(cipher, iv.length);
      const b64 = btoa(String.fromCharCode(...combined));
      return `enc:${b64}`;
    };

    const decryptToken = async (value: string): Promise<string> => {
      if (!value.startsWith('enc:')) return value;
      const key = await getCryptoKey();
      if (!key) return value;
      const b64 = value.slice(4);
      const binary = atob(b64);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      const iv = bytes.slice(0, 12);
      const cipher = bytes.slice(12);
      const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
      return new TextDecoder().decode(plainBuffer);
    };

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const { action, data } = await req.json();

    // Get ML tokens
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('ml_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(
        JSON.stringify({ error: 'Mercado Livre not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt or migrate tokens if needed
    let accessToken = await decryptToken(tokenRecord.access_token);
    let refreshToken = await decryptToken(tokenRecord.refresh_token);

    if (!tokenRecord.access_token.startsWith('enc:') || !tokenRecord.refresh_token.startsWith('enc:')) {
      try {
        const newEncryptedAccess = await encryptToken(accessToken);
        const newEncryptedRefresh = await encryptToken(refreshToken);
        await supabase
          .from('ml_tokens')
          .update({
            access_token: newEncryptedAccess,
            refresh_token: newEncryptedRefresh,
          })
          .eq('user_id', userId);
      } catch (e) {
        console.error('Failed to migrate tokens to encrypted format:', e);
      }
    }
    if (new Date(tokenRecord.expires_at) < new Date()) {
      console.log('Token expired, refreshing...');
      
      const ML_CLIENT_ID = Deno.env.get('ML_CLIENT_ID');
      const ML_CLIENT_SECRET = Deno.env.get('ML_CLIENT_SECRET');

      const refreshResponse = await fetch(`${ML_API_BASE}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: ML_CLIENT_ID!,
          client_secret: ML_CLIENT_SECRET!,
          refresh_token: tokenRecord.refresh_token,
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        console.error('Token refresh failed:', refreshData);
        return new Response(
          JSON.stringify({ error: 'Token refresh failed. Please reconnect.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      accessToken = refreshData.access_token;
      refreshToken = refreshData.refresh_token;
      const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

      const newEncryptedAccess = await encryptToken(accessToken);
      const newEncryptedRefresh = await encryptToken(refreshToken);

      await supabase
        .from('ml_tokens')
        .update({
          access_token: newEncryptedAccess,
          refresh_token: newEncryptedRefresh,
          expires_at: expiresAt.toISOString(),
        })
        .eq('user_id', userId);

      await supabase.from('operation_logs').insert({
        user_id: userId,
        operation_type: 'token_refresh',
        entity_type: 'ml_tokens',
        details: { action: 'auto_refresh' },
        status: 'success',
      });

      // Trigger webhook for token refresh
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/trigger-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'token_refresh',
            user_id: userId,
            data: { action: 'auto_refresh', timestamp: new Date().toISOString() },
          }),
        });
      } catch (webhookErr) {
        console.error('Failed to trigger webhook for token_refresh:', webhookErr);
      }
    }

    // Rate limiting check
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW);
    const { data: rateData } = await supabase
      .from('rate_limit_tracking')
      .select('request_count')
      .eq('user_id', userId)
      .eq('endpoint', 'ml-api')
      .gte('window_start', windowStart.toISOString())
      .single();

    if (rateData && rateData.request_count >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update rate limit counter
    await supabase.from('rate_limit_tracking').upsert({
      user_id: userId,
      endpoint: 'ml-api',
      request_count: (rateData?.request_count || 0) + 1,
      window_start: rateData ? undefined : new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' }).select();

    // Handle different actions
    let result;
    let operationType: 'import' | 'publish' | 'update' | 'delete' = 'import';

    switch (action) {
      case 'get_categories': {
        console.log('Fetching ML categories...');
        const response = await fetch(`${ML_API_BASE}/sites/MLB/categories`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        result = await response.json();
        break;
      }

      case 'predict_category': {
        console.log('Predicting category for:', data.title);
        const response = await fetch(
          `${ML_API_BASE}/sites/MLB/domain_discovery/search?q=${encodeURIComponent(data.title)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        result = await response.json();
        break;
      }

      case 'get_category_attributes': {
        console.log('Fetching category attributes:', data.category_id);
        const response = await fetch(
          `${ML_API_BASE}/categories/${data.category_id}/attributes`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        result = await response.json();
        break;
      }

      case 'publish_item': {
        operationType = 'publish';
        console.log('Publishing item to ML...');

        const itemData = {
          title: data.title,
          category_id: data.category_id,
          price: data.price,
          currency_id: data.currency || 'BRL',
          available_quantity: data.available_quantity || 1,
          buying_mode: 'buy_it_now',
          condition: data.condition || 'new',
          listing_type_id: data.listing_type || 'gold_special',
          description: { plain_text: data.description },
          pictures: data.images?.map((url: string) => ({ source: url })) || [],
          attributes: data.attributes || [],
        };

        const response = await fetch(`${ML_API_BASE}/items`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemData),
        });

        result = await response.json();

        if (response.ok && result.id) {
          // Update product in database
          if (data.product_id) {
            await supabase
              .from('products')
              .update({
                ml_item_id: result.id,
                ml_permalink: result.permalink,
                status: 'published',
                published_at: new Date().toISOString(),
              })
              .eq('id', data.product_id);

            await supabase.from('publication_history').insert({
              user_id: userId,
              product_id: data.product_id,
              action: 'publish',
              status: 'success',
              ml_response: result,
            });

            // Trigger webhook for successful publish
            try {
              await fetch(`${SUPABASE_URL}/functions/v1/trigger-webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event_type: 'publish_success',
                  user_id: userId,
                  data: {
                    product_id: data.product_id,
                    ml_item_id: result.id,
                    ml_permalink: result.permalink,
                    title: data.title,
                  },
                }),
              });
            } catch (webhookErr) {
              console.error('Failed to trigger webhook for publish_success:', webhookErr);
            }
          }
        } else if (data.product_id) {
          await supabase
            .from('products')
            .update({
              status: 'error',
              error_message: result.message || JSON.stringify(result.cause),
            })
            .eq('id', data.product_id);

          await supabase.from('publication_history').insert({
            user_id: userId,
            product_id: data.product_id,
            action: 'publish',
            status: 'error',
            error_details: result.message || JSON.stringify(result),
          });

          // Trigger webhook for publish error
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/trigger-webhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_type: 'publish_error',
                user_id: userId,
                data: {
                  product_id: data.product_id,
                  title: data.title,
                  error: result.message || JSON.stringify(result.cause),
                },
              }),
            });
          } catch (webhookErr) {
            console.error('Failed to trigger webhook for publish_error:', webhookErr);
          }
        }
        break;
      }

      case 'update_item': {
        operationType = 'update';
        console.log('Updating ML item:', data.ml_item_id);

        const response = await fetch(`${ML_API_BASE}/items/${data.ml_item_id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data.updates),
        });

        result = await response.json();
        break;
      }

      case 'get_item': {
        console.log('Fetching ML item:', data.ml_item_id);
        const response = await fetch(`${ML_API_BASE}/items/${data.ml_item_id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        result = await response.json();
        break;
      }

      case 'get_seller_items': {
        console.log('Fetching seller items...');
        const offset = data.offset || 0;
        const limit = data.limit || 50;
        const response = await fetch(
          `${ML_API_BASE}/users/${tokenRecord.seller_id}/items/search?offset=${offset}&limit=${limit}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        result = await response.json();
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const duration = Date.now() - startTime;

    // Log operation
    await supabase.from('operation_logs').insert({
      user_id: userId,
      operation_type: operationType,
      entity_id: data.product_id || data.ml_item_id,
      entity_type: 'product',
      details: { action },
      status: 'success',
      duration_ms: duration,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('ML API error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
