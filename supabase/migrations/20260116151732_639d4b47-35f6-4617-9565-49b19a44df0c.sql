-- Add swipe feedback preferences to user_preferences table
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS swipe_haptic_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS swipe_sound_enabled boolean DEFAULT false;