import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

interface UseProductRealtimeOptions {
  onProductUpdated?: (product: Product) => void;
  onProductInserted?: (product: Product) => void;
  onProductDeleted?: (oldProduct: Partial<Product>) => void;
}

export function useProductRealtime(options: UseProductRealtimeOptions = {}) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('products-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newProduct = payload.new as Product;
          const oldProduct = payload.old as Partial<Product>;

          // Notify on status changes
          if (oldProduct.status !== newProduct.status) {
            if (newProduct.status === 'published') {
              toast.success(`Produto "${newProduct.title}" publicado com sucesso!`, {
                description: 'Seu anúncio está ativo no Mercado Livre',
                duration: 5000,
              });
            } else if (newProduct.status === 'error') {
              toast.error(`Erro ao publicar "${newProduct.title}"`, {
                description: newProduct.error_message || 'Verifique os detalhes do produto',
                duration: 8000,
              });
            }
          }

          options.onProductUpdated?.(newProduct);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'products',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newProduct = payload.new as Product;
          options.onProductInserted?.(newProduct);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'products',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldProduct = payload.old as Partial<Product>;
          options.onProductDeleted?.(oldProduct);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, options.onProductUpdated, options.onProductInserted, options.onProductDeleted]);
}
