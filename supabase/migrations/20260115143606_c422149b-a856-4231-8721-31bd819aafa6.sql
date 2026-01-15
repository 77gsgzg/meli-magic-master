-- Add notification and timezone preferences to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo',
ADD COLUMN IF NOT EXISTS notify_publish_success BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_publish_error BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_token_refresh BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_import_success BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_import_error BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_webhook_failure BOOLEAN DEFAULT true;