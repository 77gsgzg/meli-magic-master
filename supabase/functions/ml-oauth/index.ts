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
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const ML_CLIENT_ID = Deno.env.get('ML_CLIENT_ID');
    const ML_CLIENT_SECRET = Deno.env.get('ML_CLIENT_SECRET');
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

    const isAllowedRedirectUri = (uri: string): boolean => {
      try {
        const parsed = new URL(uri);
        const protocolAllowed = parsed.protocol === 'http:' || parsed.protocol === 'https:';
        const host = parsed.hostname.toLowerCase();
        const isLocalhost = host === 'localhost' || host === '127.0.0.1';
        const isLovableHosted = host.endsWith('.lovable.app');
        return protocolAllowed && (isLocalhost || isLovableHosted);
      } catch {
        return false;
      }
    };

    if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
      console.error('ML credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Mercado Livre credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate OAuth URL for authorization
    if (action === 'authorize') {
      const redirectUri = url.searchParams.get('redirect_uri');
      if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
        return new Response(
          JSON.stringify({ error: 'Invalid redirect_uri' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      console.log('Generated ML OAuth URL');
      return new Response(
        JSON.stringify({ auth_url: authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange code for tokens
    if (action === 'callback') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      
      if (claimsError || !claimsData?.claims) {
        console.error('Auth error:', claimsError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userId = claimsData.claims.sub;
      const { code, redirect_uri } = await req.json();

      if (!code || !redirect_uri || !isAllowedRedirectUri(redirect_uri)) {
        return new Response(
          JSON.stringify({ error: 'Invalid parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Exchanging ML code for tokens...');

      // Exchange code for tokens
      const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: ML_CLIENT_ID,
          client_secret: ML_CLIENT_SECRET,
          code,
          redirect_uri,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('ML token error:', tokenData);
        return new Response(
          JSON.stringify({ error: tokenData.message || 'Failed to exchange code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('ML tokens received, fetching user info...');

      // Get user info from ML
      const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userData = await userResponse.json();

      if (!userResponse.ok) {
        console.error('ML user info error:', userData);
        return new Response(
          JSON.stringify({ error: 'Failed to get user info' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      // Upsert tokens in database (encrypted)
      const encryptedAccess = await encryptToken(tokenData.access_token);
      const encryptedRefresh = await encryptToken(tokenData.refresh_token);

      const { error: upsertError } = await supabase
        .from('ml_tokens')
        .upsert({
          user_id: userId,
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          token_type: tokenData.token_type,
          expires_at: expiresAt.toISOString(),
          ml_user_id: userData.id?.toString(),
          seller_id: userData.id?.toString(),
          nickname: userData.nickname,
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Database error:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save tokens' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log operation
      await supabase.from('operation_logs').insert({
        user_id: userId,
        operation_type: 'token_refresh',
        entity_type: 'ml_tokens',
        details: { action: 'initial_authorization', ml_user_id: userData.id },
        status: 'success',
      });

      console.log('ML OAuth completed successfully');

      return new Response(
        JSON.stringify({
          success: true,
          seller: {
            id: userData.id,
            nickname: userData.nickname,
            site_id: userData.site_id,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh tokens
    if (action === 'refresh') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      // Get current tokens
      const { data: tokenRecord, error: fetchError } = await supabase
        .from('ml_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError || !tokenRecord) {
        return new Response(
          JSON.stringify({ error: 'No ML tokens found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Refreshing ML tokens...');

      // Refresh tokens
      const refreshResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: ML_CLIENT_ID,
          client_secret: ML_CLIENT_SECRET,
          refresh_token: tokenRecord.refresh_token,
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        console.error('ML refresh error:', refreshData);
        return new Response(
          JSON.stringify({ error: refreshData.message || 'Failed to refresh tokens' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

      const newEncryptedAccess = await encryptToken(refreshData.access_token);
      const newEncryptedRefresh = await encryptToken(refreshData.refresh_token);

      // Update tokens
      await supabase
        .from('ml_tokens')
        .update({
          access_token: newEncryptedAccess,
          refresh_token: newEncryptedRefresh,
          expires_at: expiresAt.toISOString(),
        })
        .eq('user_id', userId);

      // Log operation
      await supabase.from('operation_logs').insert({
        user_id: userId,
        operation_type: 'token_refresh',
        entity_type: 'ml_tokens',
        details: { action: 'refresh' },
        status: 'success',
      });

      console.log('ML tokens refreshed successfully');

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get connection status
    if (action === 'status') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      const { data: tokenRecord } = await supabase
        .from('ml_tokens')
        .select('nickname, seller_id, expires_at')
        .eq('user_id', userId)
        .single();

      if (!tokenRecord) {
        return new Response(
          JSON.stringify({ connected: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isExpired = new Date(tokenRecord.expires_at) < new Date();

      return new Response(
        JSON.stringify({
          connected: true,
          nickname: tokenRecord.nickname,
          seller_id: tokenRecord.seller_id,
          is_expired: isExpired,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Disconnect ML account
    if (action === 'disconnect') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      console.log('Disconnecting ML account for user:', userId);

      // Delete tokens from database
      const { error: deleteError } = await supabase
        .from('ml_tokens')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting tokens:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log operation
      await supabase.from('operation_logs').insert({
        user_id: userId,
        operation_type: 'delete',
        entity_type: 'ml_tokens',
        details: { action: 'disconnect' },
        status: 'success',
      });

      console.log('ML account disconnected successfully');

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('ML OAuth error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
