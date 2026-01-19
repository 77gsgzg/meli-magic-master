-- Create supplier_products table for persistence
CREATE TABLE public.supplier_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'BRL',
  image_url TEXT,
  product_url TEXT,
  optimized_title TEXT,
  optimized_description TEXT,
  strategy TEXT DEFAULT 'balanced',
  margin NUMERIC DEFAULT 30,
  target_price NUMERIC,
  positioning TEXT DEFAULT 'moderate',
  is_published BOOLEAN DEFAULT false,
  published_product_id UUID REFERENCES public.products(id),
  ml_item_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own supplier products"
ON public.supplier_products
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own supplier products"
ON public.supplier_products
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supplier products"
ON public.supplier_products
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supplier products"
ON public.supplier_products
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_supplier_products_updated_at
BEFORE UPDATE ON public.supplier_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();