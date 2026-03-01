
-- 1. Wallets table (one per user)
CREATE TABLE public.wallets (
  user_id UUID NOT NULL PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Wallet transactions table
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  order_id UUID REFERENCES public.ml_orders(id),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Add cost_price and locked_at to ml_orders
ALTER TABLE public.ml_orders
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- 4. Atomic debit function (called by edge function with service role)
CREATE OR REPLACE FUNCTION public.process_order_wallet_debit(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_balance NUMERIC;
  v_result JSONB;
BEGIN
  -- Lock the order row
  SELECT id, user_id, status, cost_price, locked_at
    INTO v_order
    FROM ml_orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  -- Check if already locked
  IF v_order.locked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_already_locked');
  END IF;

  -- Check if debit already exists for this order
  IF EXISTS (SELECT 1 FROM wallet_transactions WHERE order_id = p_order_id AND type = 'debit') THEN
    RETURN jsonb_build_object('success', false, 'error', 'debit_already_exists');
  END IF;

  -- Check cost_price
  IF v_order.cost_price IS NULL OR v_order.cost_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_cost_price');
  END IF;

  -- Lock and get wallet balance
  SELECT balance INTO v_balance
    FROM wallets
    WHERE user_id = v_order.user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-create wallet with 0 balance
    INSERT INTO wallets (user_id, balance) VALUES (v_order.user_id, 0);
    v_balance := 0;
  END IF;

  -- Check sufficient balance
  IF v_balance < v_order.cost_price THEN
    UPDATE ml_orders SET status = 'insufficient_balance' WHERE id = p_order_id;
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_balance, 'cost', v_order.cost_price);
  END IF;

  -- Debit
  UPDATE wallets SET balance = balance - v_order.cost_price WHERE user_id = v_order.user_id;

  -- Create transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, order_id, description)
    VALUES (v_order.user_id, 'debit', v_order.cost_price, p_order_id, 'Débito automático - pedido aprovado');

  -- Lock the order and set ready
  UPDATE ml_orders SET locked_at = now(), status = 'ready_to_purchase' WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'debited', v_order.cost_price);
END;
$$;

-- 5. Credit function
CREATE OR REPLACE FUNCTION public.wallet_add_credit(p_user_id UUID, p_amount NUMERIC, p_description TEXT DEFAULT 'Crédito manual')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  INSERT INTO wallets (user_id, balance) VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + p_amount;

  INSERT INTO wallet_transactions (user_id, type, amount, description)
    VALUES (p_user_id, 'credit', p_amount, p_description);

  RETURN jsonb_build_object('success', true, 'credited', p_amount);
END;
$$;

-- 6. Trigger to prevent updates on locked order fields
CREATE OR REPLACE FUNCTION public.prevent_locked_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    IF NEW.buyer_first_name IS DISTINCT FROM OLD.buyer_first_name
      OR NEW.buyer_last_name IS DISTINCT FROM OLD.buyer_last_name
      OR NEW.buyer_document_number IS DISTINCT FROM OLD.buyer_document_number
      OR NEW.buyer_document_type IS DISTINCT FROM OLD.buyer_document_type
      OR NEW.shipping_address_line IS DISTINCT FROM OLD.shipping_address_line
      OR NEW.shipping_address_city IS DISTINCT FROM OLD.shipping_address_city
      OR NEW.shipping_address_state IS DISTINCT FROM OLD.shipping_address_state
      OR NEW.shipping_address_zip_code IS DISTINCT FROM OLD.shipping_address_zip_code
      OR NEW.cost_price IS DISTINCT FROM OLD.cost_price
      OR NEW.product_id IS DISTINCT FROM OLD.product_id
    THEN
      RAISE EXCEPTION 'Pedido bloqueado (locked_at preenchido). Não é possível alterar dados congelados.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_locked_order_changes_trigger
  BEFORE UPDATE ON public.ml_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_order_changes();
