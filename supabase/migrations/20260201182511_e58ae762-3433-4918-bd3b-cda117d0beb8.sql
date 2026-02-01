-- Fix: Restrict cron_job_logs access to admin users only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone authenticated can view cron job logs" ON public.cron_job_logs;

-- Create admin-only policy using the existing has_role function
CREATE POLICY "Only admins can view cron job logs"
ON public.cron_job_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));