
-- Create table for cron job execution logs
CREATE TABLE public.cron_job_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running',
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert/update (edge functions use service role)
-- Users can only view logs (no user_id needed for system logs)
CREATE POLICY "Anyone authenticated can view cron job logs"
ON public.cron_job_logs
FOR SELECT
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX idx_cron_job_logs_job_name ON public.cron_job_logs(job_name);
CREATE INDEX idx_cron_job_logs_started_at ON public.cron_job_logs(started_at DESC);
