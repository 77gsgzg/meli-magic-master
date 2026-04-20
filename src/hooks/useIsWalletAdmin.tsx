import { useIsAdmin } from "./useIsAdmin";

/**
 * Mantido por compatibilidade com imports existentes (Wallet, AI Images, TikTok).
 * Agora baseia-se na role 'admin' do banco — não mais em email hardcoded.
 */
export function useIsWalletAdmin() {
  const { isAdmin, loading } = useIsAdmin();
  return { isAdmin, loading };
}
