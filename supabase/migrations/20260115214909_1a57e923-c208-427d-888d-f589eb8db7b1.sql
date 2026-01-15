-- Create table for scheduled batch imports
CREATE TABLE public.scheduled_batch_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  urls TEXT[] NOT NULL DEFAULT '{}',
  frequency TEXT NOT NULL DEFAULT 'daily',
  hour_of_day INTEGER NOT NULL DEFAULT 9,
  day_of_week INTEGER,
  day_of_month INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_batch_imports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own scheduled imports" 
ON public.scheduled_batch_imports 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled imports" 
ON public.scheduled_batch_imports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled imports" 
ON public.scheduled_batch_imports 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled imports" 
ON public.scheduled_batch_imports 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_scheduled_batch_imports_updated_at
BEFORE UPDATE ON public.scheduled_batch_imports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for batch import history/logs
CREATE TABLE public.batch_import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scheduled_import_id UUID REFERENCES public.scheduled_batch_imports(id) ON DELETE SET NULL,
  batch_id TEXT NOT NULL,
  total_urls INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  items JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.batch_import_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own batch import logs" 
ON public.batch_import_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own batch import logs" 
ON public.batch_import_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);