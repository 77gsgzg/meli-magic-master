-- Add supplier price alert settings to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS supplier_price_alert_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS supplier_price_threshold numeric DEFAULT 10,
ADD COLUMN IF NOT EXISTS supplier_alert_email_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS supplier_alert_push_enabled boolean DEFAULT true;

-- Create table for supplier price change history
CREATE TABLE IF NOT EXISTS public.supplier_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_product_id UUID NOT NULL REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  old_price numeric NOT NULL,
  new_price numeric NOT NULL,
  price_change_percent numeric NOT NULL,
  detected_at timestamp with time zone NOT NULL DEFAULT now(),
  alert_sent boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_price_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own price history" 
ON public.supplier_price_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own price history" 
ON public.supplier_price_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_supplier_price_history_user ON public.supplier_price_history(user_id);
CREATE INDEX idx_supplier_price_history_product ON public.supplier_price_history(supplier_product_id);