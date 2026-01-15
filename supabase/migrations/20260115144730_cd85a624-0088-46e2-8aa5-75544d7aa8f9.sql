-- Create table for user goals and thresholds
CREATE TABLE public.user_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  metric_key TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  comparison_operator TEXT NOT NULL DEFAULT 'gte', -- gte, lte, gt, lt, eq
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, metric_key)
);

-- Enable RLS
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own goals"
  ON public.user_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON public.user_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON public.user_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON public.user_goals FOR DELETE
  USING (auth.uid() = user_id);

-- Create table for goal alerts history
CREATE TABLE public.goal_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES public.user_goals(id) ON DELETE CASCADE,
  current_value NUMERIC NOT NULL,
  target_value NUMERIC NOT NULL,
  alert_type TEXT NOT NULL, -- warning, critical
  message TEXT,
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.goal_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own alerts"
  ON public.goal_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
  ON public.goal_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON public.goal_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON public.goal_alerts FOR DELETE
  USING (auth.uid() = user_id);