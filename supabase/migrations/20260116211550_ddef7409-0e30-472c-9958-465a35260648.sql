-- Create orders table to store Mercado Livre orders
CREATE TABLE public.ml_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ml_order_id TEXT NOT NULL UNIQUE,
  ml_pack_id TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  
  -- Order info
  status TEXT NOT NULL,
  date_created TIMESTAMP WITH TIME ZONE NOT NULL,
  date_closed TIMESTAMP WITH TIME ZONE,
  
  -- Buyer info (from ML API - stored securely)
  buyer_id TEXT NOT NULL,
  buyer_nickname TEXT NOT NULL,
  buyer_first_name TEXT,
  buyer_last_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  buyer_document_type TEXT,
  buyer_document_number TEXT,
  
  -- Shipping address (from ML API)
  shipping_id TEXT,
  shipping_status TEXT,
  shipping_receiver_name TEXT,
  shipping_address_line TEXT,
  shipping_address_city TEXT,
  shipping_address_state TEXT,
  shipping_address_zip_code TEXT,
  shipping_address_country TEXT,
  
  -- Item info
  ml_item_id TEXT NOT NULL,
  item_title TEXT NOT NULL,
  item_quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  currency_id TEXT DEFAULT 'BRL',
  
  -- Payment info
  payment_status TEXT,
  total_amount NUMERIC,
  
  -- Tracking
  tracking_number TEXT,
  tracking_url TEXT,
  
  -- Raw data for reference
  raw_order_data JSONB,
  raw_shipping_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.ml_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only see their own orders
CREATE POLICY "Users can view their own orders"
  ON public.ml_orders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
  ON public.ml_orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
  ON public.ml_orders
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_ml_orders_user_id ON public.ml_orders(user_id);
CREATE INDEX idx_ml_orders_ml_order_id ON public.ml_orders(ml_order_id);
CREATE INDEX idx_ml_orders_status ON public.ml_orders(status);
CREATE INDEX idx_ml_orders_product_id ON public.ml_orders(product_id);

-- Trigger for updated_at
CREATE TRIGGER update_ml_orders_updated_at
  BEFORE UPDATE ON public.ml_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.ml_orders;