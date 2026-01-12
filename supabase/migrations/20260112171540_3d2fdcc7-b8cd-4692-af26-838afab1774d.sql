-- Tabela para mapear ações de publicação para tipos de operação de logs
CREATE TABLE IF NOT EXISTS public.publication_action_mappings (
  user_id uuid NOT NULL,
  action text NOT NULL,
  operation_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action)
);

ALTER TABLE public.publication_action_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own publication action mappings"
ON public.publication_action_mappings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own publication action mappings"
ON public.publication_action_mappings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own publication action mappings"
ON public.publication_action_mappings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_publication_action_mappings_updated_at
BEFORE UPDATE ON public.publication_action_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();