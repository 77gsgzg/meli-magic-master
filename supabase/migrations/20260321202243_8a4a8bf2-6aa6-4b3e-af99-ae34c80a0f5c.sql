
-- TikTok Miner tables (isolated, no changes to existing tables)

CREATE TABLE public.tiktok_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments_count BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  author_username TEXT,
  description TEXT,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view tiktok videos" ON public.tiktok_videos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert tiktok videos" ON public.tiktok_videos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

CREATE POLICY "Admin can delete tiktok videos" ON public.tiktok_videos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

-- Analysis table
CREATE TABLE public.tiktok_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.tiktok_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  detected_product TEXT,
  transcript TEXT,
  trend_type TEXT,
  comments_summary TEXT,
  potential_score NUMERIC DEFAULT 0 CHECK (potential_score >= 0 AND potential_score <= 10),
  virality_reason TEXT,
  video_summary TEXT,
  raw_analysis JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view tiktok analysis" ON public.tiktok_analysis
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert tiktok analysis" ON public.tiktok_analysis
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

-- Generated creatives (for future use)
CREATE TABLE public.generated_creatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_video_id UUID NOT NULL REFERENCES public.tiktok_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  script TEXT,
  generated_video_url TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view creatives" ON public.generated_creatives
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert creatives" ON public.generated_creatives
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

CREATE POLICY "Admin can update creatives" ON public.generated_creatives
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

-- Performance logs
CREATE TABLE public.tiktok_performance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creative_id UUID REFERENCES public.generated_creatives(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL DEFAULT 'tiktok',
  views BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_performance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view performance logs" ON public.tiktok_performance_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert performance logs" ON public.tiktok_performance_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);
