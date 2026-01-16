-- Order alert settings (per user)
CREATE TABLE IF NOT EXISTS public.order_alert_settings (
  user_id uuid PRIMARY KEY,
  new_order_push_enabled boolean NOT NULL DEFAULT true,
  shipping_delay_alert_enabled boolean NOT NULL DEFAULT true,
  shipping_delay_hours integer NOT NULL DEFAULT 24,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.order_alert_settings ENABLE ROW LEVEL SECURITY;

-- RLS: user can view/update/insert own settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_alert_settings' AND policyname='Users can view own order alert settings'
  ) THEN
    CREATE POLICY "Users can view own order alert settings"
    ON public.order_alert_settings
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_alert_settings' AND policyname='Users can upsert own order alert settings'
  ) THEN
    CREATE POLICY "Users can upsert own order alert settings"
    ON public.order_alert_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_alert_settings' AND policyname='Users can update own order alert settings'
  ) THEN
    CREATE POLICY "Users can update own order alert settings"
    ON public.order_alert_settings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at trigger function already exists; create trigger for this table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_order_alert_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_order_alert_settings_updated_at
    BEFORE UPDATE ON public.order_alert_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
