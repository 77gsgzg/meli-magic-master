-- Create table for discovered suppliers from location search
CREATE TABLE public.discovered_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Brasil',
  latitude NUMERIC,
  longitude NUMERIC,
  phone TEXT,
  website TEXT,
  place_id TEXT,
  business_type TEXT,
  economic_profile TEXT,
  distance_km NUMERIC,
  source TEXT NOT NULL DEFAULT 'google_places',
  raw_data JSONB,
  is_added_to_suppliers BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discovered_suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own discovered suppliers"
  ON public.discovered_suppliers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own discovered suppliers"
  ON public.discovered_suppliers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discovered suppliers"
  ON public.discovered_suppliers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discovered suppliers"
  ON public.discovered_suppliers FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_discovered_suppliers_updated_at
  BEFORE UPDATE ON public.discovered_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for better performance
CREATE INDEX idx_discovered_suppliers_user_id ON public.discovered_suppliers(user_id);
CREATE INDEX idx_discovered_suppliers_city ON public.discovered_suppliers(city);
CREATE INDEX idx_discovered_suppliers_place_id ON public.discovered_suppliers(place_id);