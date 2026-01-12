-- Tabela para armazenar preferências de alertas de segurança por usuário
CREATE TABLE IF NOT EXISTS public.security_alert_settings (
  user_id uuid PRIMARY KEY,
  error_threshold integer NOT NULL DEFAULT 10,
  window_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: cada usuário só vê/atualiza suas próprias configurações
ALTER TABLE public.security_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own security alert settings"
ON public.security_alert_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own security alert settings"
ON public.security_alert_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own security alert settings"
ON public.security_alert_settings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para manter updated_at sempre atualizado
CREATE TRIGGER update_security_alert_settings_updated_at
BEFORE UPDATE ON public.security_alert_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();