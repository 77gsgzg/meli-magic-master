-- Add columns for pause/resume functionality to batch_import_logs
ALTER TABLE public.batch_import_logs
ADD COLUMN IF NOT EXISTS processed_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS remaining_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_resume BOOLEAN DEFAULT false;

-- Allow users to update their own batch import logs for pause/resume
CREATE POLICY "Users can update their own batch import logs" 
ON public.batch_import_logs 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for faster querying of resumable imports
CREATE INDEX IF NOT EXISTS idx_batch_import_logs_resumable 
ON public.batch_import_logs(user_id, is_paused, can_resume) 
WHERE is_paused = true AND can_resume = true;