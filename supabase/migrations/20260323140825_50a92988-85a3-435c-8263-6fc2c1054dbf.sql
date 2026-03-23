
-- Table for creative models/patterns extracted from videos
CREATE TABLE public.video_creative_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id UUID REFERENCES public.tiktok_videos(id) ON DELETE SET NULL,
  hook_type TEXT,
  opening_style TEXT,
  selling_style TEXT,
  pacing TEXT,
  format TEXT,
  structure_summary TEXT,
  tags TEXT[] DEFAULT '{}'::TEXT[],
  notes TEXT,
  raw_extraction JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add status column to tiktok_videos for feed management (saved, ignored, analyzed)
ALTER TABLE public.tiktok_videos ADD COLUMN IF NOT EXISTS feed_status TEXT DEFAULT 'new';
ALTER TABLE public.tiktok_videos ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.tiktok_videos ADD COLUMN IF NOT EXISTS is_model BOOLEAN DEFAULT false;
ALTER TABLE public.tiktok_videos ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- RLS for video_creative_models
ALTER TABLE public.video_creative_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view creative models"
  ON public.video_creative_models FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can insert creative models"
  ON public.video_creative_models FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Admin can update creative models"
  ON public.video_creative_models FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Admin can delete creative models"
  ON public.video_creative_models FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

-- Update RLS for tiktok_videos to allow updates (needed for feed_status)
CREATE POLICY "Admin can update tiktok videos"
  ON public.tiktok_videos FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);
