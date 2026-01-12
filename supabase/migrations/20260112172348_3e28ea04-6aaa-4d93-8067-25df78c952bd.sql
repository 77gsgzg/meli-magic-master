ALTER TABLE public.publication_action_mappings
ADD COLUMN IF NOT EXISTS description text;

-- Keep existing trigger update_publication_action_mappings_updated_at, no changes needed.
