
-- Table for AI generated images
CREATE TABLE public.ai_generated_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  original_image_url text,
  generated_image_urls jsonb DEFAULT '[]'::jsonb,
  style text NOT NULL DEFAULT 'white_background',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai images" ON public.ai_generated_images FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai images" ON public.ai_generated_images FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai images" ON public.ai_generated_images FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai images" ON public.ai_generated_images FOR DELETE USING (auth.uid() = user_id);

-- Table for AI generated texts
CREATE TABLE public.ai_generated_texts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_title text,
  short_description text,
  long_description text,
  benefits text,
  specifications text,
  cta text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generated_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai texts" ON public.ai_generated_texts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai texts" ON public.ai_generated_texts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai texts" ON public.ai_generated_texts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai texts" ON public.ai_generated_texts FOR DELETE USING (auth.uid() = user_id);
