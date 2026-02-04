import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface MLConnection {
  connected: boolean;
  nickname?: string;
  seller_id?: string;
  is_expired?: boolean;
}

export function useMercadoLivre() {
  const { session } = useAuth();
  const [connection, setConnection] = useState<MLConnection>({ connected: false });
  const [loading, setLoading] = useState(true);

  const mapMlError = (message: string | undefined): string => {
    if (!message) return 'Erro ao comunicar com o Mercado Livre. Tente novamente.';
    const msg = message.toLowerCase();

    if (msg.includes('invalid redirect') || msg.includes('redirect_uri')) {
      return 'URL de retorno inválida. Atualize a página e tente novamente.';
    }

    if (msg.includes('invalid_grant') || msg.includes('authorization code')) {
      return 'Sessão de autorização expirada ou já utilizada. Recomece o fluxo de conexão.';
    }

    if (msg.includes('invalid_client')) {
      return 'Credenciais da aplicação inválidas. Entre em contato com o suporte.';
    }

    if (msg.includes('temporarily_unavailable')) {
      return 'Serviço do Mercado Livre temporariamente indisponível. Tente novamente em alguns minutos.';
    }

    if (msg.includes('rate') && msg.includes('limit')) {
      return 'Limite de chamadas à API do Mercado Livre atingido. Aguarde um pouco antes de tentar de novo.';
    }

    return message;
  };

  const checkConnection = async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-oauth?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setConnection(result);
      }
    } catch (error) {
      console.error('Error checking ML connection:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, [session]);

  const getAuthUrl = async (redirectUri: string, codeChallenge?: string): Promise<string | null> => {
    if (!session?.access_token) return null;

    try {
      let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-oauth?action=authorize&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      // Adiciona code_challenge se PKCE estiver habilitado
      if (codeChallenge) {
        url += `&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.auth_url) {
        return result.auth_url;
      }

      toast.error(mapMlError(result.error));
      return null;
    } catch (error) {
      console.error('Error getting auth URL:', error);
      toast.error('Erro ao conectar com Mercado Livre');
      return null;
    }
  };

  const handleCallback = async (code: string, redirectUri: string, codeVerifier?: string): Promise<boolean> => {
    console.log('[ML handleCallback] Iniciando troca de token...');
    console.log('[ML handleCallback] session disponível:', !!session?.access_token);
    
    if (!session?.access_token) {
      console.error('[ML handleCallback] Sem sessão ativa - usuário não autenticado');
      toast.error('Sessão expirada. Faça login novamente.');
      return false;
    }

    try {
      const body: Record<string, string> = { code, redirect_uri: redirectUri };
      
      // Adiciona code_verifier se PKCE estiver habilitado
      if (codeVerifier) {
        body.code_verifier = codeVerifier;
        console.log('[ML handleCallback] code_verifier incluído no body');
      } else {
        console.warn('[ML handleCallback] code_verifier NÃO fornecido');
      }

      console.log('[ML handleCallback] Enviando request para ml-oauth callback...');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-oauth?action=callback`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      console.log('[ML handleCallback] Response status:', response.status);
      
      const result = await response.json();
      console.log('[ML handleCallback] Response body:', result);

      if (response.ok && result.success) {
        setConnection({
          connected: true,
          nickname: result.seller?.nickname,
          seller_id: result.seller?.id?.toString(),
        });
        // Não mostrar toast aqui - será mostrado no hook OAuth
        return true;
      }

      console.error('[ML handleCallback] Erro:', result.error);
      toast.error(mapMlError(result.error));
      return false;
    } catch (error) {
      console.error('[ML handleCallback] Erro na requisição:', error);
      toast.error('Erro ao processar autorização');
      return false;
    }
  };

  const disconnect = async (): Promise<boolean> => {
    if (!session?.access_token) return false;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-oauth?action=disconnect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setConnection({ connected: false });
        toast.success('Mercado Livre desconectado com sucesso!');
        return true;
      }

      toast.error(mapMlError(result.error));
      return false;
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar Mercado Livre');
      return false;
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    if (!session?.access_token) return false;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-oauth?action=refresh`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        await checkConnection();
        toast.success('Token renovado com sucesso!');
        return true;
      }

      toast.error(mapMlError(result.error));
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast.error('Erro ao renovar token');
      return false;
    }
  };

  const callMLApi = async (action: string, data?: Record<string, unknown>) => {
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-api`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, data }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(mapMlError(result.error));
    }

    return result;
  };

  const getDiagnostics = async () => {
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-oauth?action=diagnostics`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(mapMlError(result.error));
    }

    return result;
  };

  return {
    connection,
    loading,
    checkConnection,
    getAuthUrl,
    handleCallback,
    disconnect,
    refreshToken,
    callMLApi,
    getDiagnostics,
  };
}
