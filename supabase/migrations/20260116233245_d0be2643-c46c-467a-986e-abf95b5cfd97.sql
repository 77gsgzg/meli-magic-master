-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- (Optional but recommended) make sure cron schema is available
-- Supabase manages permissions; no additional grants needed here.
