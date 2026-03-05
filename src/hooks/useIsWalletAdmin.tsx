import { useAuth } from './useAuth';

const WALLET_ADMIN_EMAIL = 'farmatgu@gmail.com';

export function useIsWalletAdmin() {
  const { user, loading } = useAuth();
  const isAdmin = !loading && user?.email === WALLET_ADMIN_EMAIL;
  return { isAdmin, loading };
}
