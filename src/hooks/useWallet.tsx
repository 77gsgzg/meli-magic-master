import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useIsAdmin } from './useIsAdmin';
import { toast } from 'sonner';

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: 'credit' | 'debit';
  amount: number;
  order_id: string | null;
  description: string | null;
  created_at: string;
}

export function useWallet() {
  const { session } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!session?.user?.id || !isAdmin) return;
    try {
      const { data, error } = await supabase.functions.invoke('wallet-manage', {
        body: { action: 'get_balance' },
      });
      if (error) throw error;
      setBalance(data?.balance ?? 0);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  }, [session?.user?.id]);

  const fetchTransactions = useCallback(async (limit = 50, offset = 0) => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('wallet-manage', {
        body: { action: 'get_transactions', limit, offset },
      });
      if (error) throw error;
      setTransactions(data?.transactions ?? []);
      setTotalTransactions(data?.total ?? 0);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  }, [session?.user?.id]);

  const addCredit = useCallback(async (amount: number, description?: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-manage', {
        body: { action: 'add_credit', amount, description },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`R$ ${amount.toFixed(2)} creditado com sucesso`);
        await fetchBalance();
        await fetchTransactions();
      } else {
        toast.error(data?.error || 'Erro ao adicionar crédito');
      }
      return data;
    } catch (error) {
      console.error('Error adding credit:', error);
      toast.error('Erro ao adicionar crédito');
      return null;
    } finally {
      setActionLoading(false);
    }
  }, [fetchBalance, fetchTransactions]);

  const processOrderDebit = useCallback(async (orderId: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-manage', {
        body: { action: 'process_order_debit', order_id: orderId },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Débito processado com sucesso');
        await fetchBalance();
        await fetchTransactions();
      } else {
        const errorMap: Record<string, string> = {
          order_already_locked: 'Pedido já foi processado',
          debit_already_exists: 'Débito já realizado para este pedido',
          insufficient_balance: `Saldo insuficiente (saldo: R$ ${data?.balance?.toFixed(2)}, custo: R$ ${data?.cost?.toFixed(2)})`,
          invalid_cost_price: 'Preço de custo não definido no pedido',
          order_not_found: 'Pedido não encontrado',
        };
        toast.error(errorMap[data?.error] || data?.error || 'Erro ao processar débito');
      }
      return data;
    } catch (error) {
      console.error('Error processing debit:', error);
      toast.error('Erro ao processar débito');
      return null;
    } finally {
      setActionLoading(false);
    }
  }, [fetchBalance, fetchTransactions]);

  useEffect(() => {
    if (session?.user?.id) {
      setLoading(true);
      Promise.all([fetchBalance(), fetchTransactions()]).finally(() => setLoading(false));
    }
  }, [session?.user?.id, fetchBalance, fetchTransactions]);

  return {
    balance,
    transactions,
    totalTransactions,
    loading,
    actionLoading,
    addCredit,
    processOrderDebit,
    refreshBalance: fetchBalance,
    refreshTransactions: fetchTransactions,
  };
}
