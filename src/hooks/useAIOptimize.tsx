import { useState } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface OptimizeResult {
  optimized_title: string;
  optimized_description: string;
  suggested_keywords: string[];
  quality_score: number;
  improvements: string[];
}

export function useAIOptimize() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  const optimizeProduct = async (
    title: string,
    description?: string,
    category?: string,
    attributes?: Record<string, unknown>[]
  ): Promise<OptimizeResult | null> => {
    if (!session?.access_token) {
      toast.error('Você precisa estar logado');
      return null;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-optimize`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title, description, category, attributes }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Limite de requisições atingido. Aguarde um momento.');
        } else if (response.status === 402) {
          toast.error('Créditos de IA esgotados.');
        } else {
          toast.error(result.error || 'Erro na otimização');
        }
        return null;
      }

      return result;
    } catch (error) {
      console.error('AI optimize error:', error);
      toast.error('Erro ao otimizar produto');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    optimizeProduct,
    loading,
  };
}
