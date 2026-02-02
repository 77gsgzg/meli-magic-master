-- Add theme column to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS theme text DEFAULT 'system';

-- Add comment to describe the column
COMMENT ON COLUMN public.user_preferences.theme IS 'User theme preference: light, dark, or system';