import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type Product = Tables<'products'>;
type ProductInsert = TablesInsert<'products'>;
type ProductUpdate = TablesUpdate<'products'>;

export function useProducts() {
  const { user, session } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const createProduct = async (productData: Omit<ProductInsert, 'user_id'>) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...productData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setProducts(prev => [data, ...prev]);
      toast.success('Produto criado com sucesso');
      return data;
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Erro ao criar produto');
      return null;
    }
  };

  const updateProduct = async (id: string, updates: ProductUpdate) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setProducts(prev => prev.map(p => p.id === id ? data : p));
      return data;
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Erro ao atualizar produto');
      return null;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success('Produto removido');
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Erro ao remover produto');
      return false;
    }
  };

  const getProductStats = () => {
    const total = products.length;
    const published = products.filter(p => p.status === 'published').length;
    const pending = products.filter(p => p.status === 'pending').length;
    const draft = products.filter(p => p.status === 'draft').length;
    const errors = products.filter(p => p.status === 'error').length;

    return { total, published, pending, draft, errors };
  };

  return {
    products,
    loading,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductStats,
  };
}
