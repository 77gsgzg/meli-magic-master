-- Add is_favorite column to discovered_suppliers table
ALTER TABLE public.discovered_suppliers 
ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

-- Add catalog_url column for automatic product import
ALTER TABLE public.discovered_suppliers 
ADD COLUMN IF NOT EXISTS catalog_url text;

-- Add alert settings for favorites
ALTER TABLE public.discovered_suppliers 
ADD COLUMN IF NOT EXISTS alert_new_products boolean DEFAULT true;

-- Add last product check timestamp
ALTER TABLE public.discovered_suppliers 
ADD COLUMN IF NOT EXISTS last_product_check_at timestamp with time zone;

-- Add product count for tracking
ALTER TABLE public.discovered_suppliers 
ADD COLUMN IF NOT EXISTS product_count integer DEFAULT 0;

-- Create index for favorites lookup
CREATE INDEX IF NOT EXISTS idx_discovered_suppliers_favorites 
ON public.discovered_suppliers(user_id, is_favorite) 
WHERE is_favorite = true;