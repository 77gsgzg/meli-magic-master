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

  const checkConnection = async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('ml-oauth', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {},
        method: 'GET',
      });

      // Use query params approach
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

  const getAuthUrl = async (redirectUri: string): Promise<string | null> => {
    if (!session?.access_token) return null;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-oauth?action=authorize&redirect_uri=${encodeURIComponent(redirectUri)}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (response.ok && result.auth_url) {
        return result.auth_url;
      }

      toast.error(result.error || 'Erro ao gerar URL de autorização');
      return null;
    } catch (error) {
      console.error('Error getting auth URL:', error);
      toast.error('Erro ao conectar com Mercado Livre');
      return null;
    }
  };

  const handleCallback = async (code: string, redirectUri: string): Promise<boolean> => {
    if (!session?.access_token) return false;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-oauth?action=callback`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setConnection({
          connected: true,
          nickname: result.seller?.nickname,
          seller_id: result.seller?.id?.toString(),
        });
        toast.success('Mercado Livre conectado com sucesso!');
        return true;
      }

      toast.error(result.error || 'Erro ao conectar Mercado Livre');
      return false;
    } catch (error) {
      console.error('Error handling callback:', error);
      toast.error('Erro ao processar autorização');
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
      throw new Error(result.error || 'API error');
    }

    return result;
  };

  return {
    connection,
    loading,
    checkConnection,
    getAuthUrl,
    handleCallback,
    callMLApi,
  };
}
