
-- Wallets: remove client-side INSERT/UPDATE policies; mutations only via SECURITY DEFINER RPC / service role
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

-- Wallet transactions: remove client INSERT policy; created only by RPC / service role
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.wallet_transactions;

-- Storage: remove overly-permissive product-images INSERT (cross-folder writes); keep folder-scoped policy
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own images" ON storage.objects;

-- user_roles: explicit admin-only management; defense in depth (no policy = denied, but make intent clear)
DROP POLICY IF EXISTS "Admins manage user roles" ON public.user_roles;
CREATE POLICY "Admins manage user roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
