
CREATE TABLE public.ai_image_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_image_url TEXT NOT NULL,
  edited_image_url TEXT,
  prompt TEXT NOT NULL,
  edit_type TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_image_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own edits"
  ON public.ai_image_edits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own edits"
  ON public.ai_image_edits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own edits"
  ON public.ai_image_edits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own edits"
  ON public.ai_image_edits FOR DELETE
  USING (auth.uid() = user_id);
