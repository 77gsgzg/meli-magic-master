-- Supplier savings opportunities settings
CREATE TABLE IF NOT EXISTS public.supplier_savings_settings (
  user_id uuid NOT NULL PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  percent_threshold numeric NOT NULL DEFAULT 10,
  amount_threshold numeric NOT NULL DEFAULT 20,
  lookback_days integer NOT NULL DEFAULT 30,
  max_opportunities_per_run integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_savings_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_savings_settings' AND policyname='Users can view own supplier savings settings') THEN
    EXECUTE 'DROP POLICY "Users can view own supplier savings settings" ON public.supplier_savings_settings';
  END IF;
END $$;
CREATE POLICY "Users can view own supplier savings settings"
ON public.supplier_savings_settings
FOR SELECT
USING (auth.uid() = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_savings_settings' AND policyname='Users can upsert own supplier savings settings') THEN
    EXECUTE 'DROP POLICY "Users can upsert own supplier savings settings" ON public.supplier_savings_settings';
  END IF;
END $$;
CREATE POLICY "Users can upsert own supplier savings settings"
ON public.supplier_savings_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_savings_settings' AND policyname='Users can update own supplier savings settings') THEN
    EXECUTE 'DROP POLICY "Users can update own supplier savings settings" ON public.supplier_savings_settings';
  END IF;
END $$;
CREATE POLICY "Users can update own supplier savings settings"
ON public.supplier_savings_settings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Opportunities table
CREATE TABLE IF NOT EXISTS public.supplier_savings_opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  group_key text NOT NULL,
  representative_title text NOT NULL,
  cheapest_supplier_name text NOT NULL,
  cheapest_price numeric NOT NULL,
  expensive_supplier_name text NOT NULL,
  expensive_price numeric NOT NULL,
  spread_percent numeric NOT NULL,
  spread_amount numeric NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new',
  seen_at timestamptz NULL,
  dismissed_at timestamptz NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_savings_opps_user_detected
ON public.supplier_savings_opportunities (user_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_savings_opps_user_status
ON public.supplier_savings_opportunities (user_id, status);

ALTER TABLE public.supplier_savings_opportunities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_savings_opportunities' AND policyname='Users can view own supplier savings opportunities') THEN
    EXECUTE 'DROP POLICY "Users can view own supplier savings opportunities" ON public.supplier_savings_opportunities';
  END IF;
END $$;
CREATE POLICY "Users can view own supplier savings opportunities"
ON public.supplier_savings_opportunities
FOR SELECT
USING (auth.uid() = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_savings_opportunities' AND policyname='Users can insert own supplier savings opportunities') THEN
    EXECUTE 'DROP POLICY "Users can insert own supplier savings opportunities" ON public.supplier_savings_opportunities';
  END IF;
END $$;
CREATE POLICY "Users can insert own supplier savings opportunities"
ON public.supplier_savings_opportunities
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_savings_opportunities' AND policyname='Users can update own supplier savings opportunities') THEN
    EXECUTE 'DROP POLICY "Users can update own supplier savings opportunities" ON public.supplier_savings_opportunities';
  END IF;
END $$;
CREATE POLICY "Users can update own supplier savings opportunities"
ON public.supplier_savings_opportunities
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Alerts log
CREATE TABLE IF NOT EXISTS public.supplier_savings_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  opportunity_id uuid NULL REFERENCES public.supplier_savings_opportunities(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'push',
  message text NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_savings_alerts_user_sent
ON public.supplier_savings_alerts (user_id, sent_at DESC);

ALTER TABLE public.supplier_savings_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_savings_alerts' AND policyname='Users can view own supplier savings alerts') THEN
    EXECUTE 'DROP POLICY "Users can view own supplier savings alerts" ON public.supplier_savings_alerts';
  END IF;
END $$;
CREATE POLICY "Users can view own supplier savings alerts"
ON public.supplier_savings_alerts
FOR SELECT
USING (auth.uid() = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_savings_alerts' AND policyname='Users can insert own supplier savings alerts') THEN
    EXECUTE 'DROP POLICY "Users can insert own supplier savings alerts" ON public.supplier_savings_alerts';
  END IF;
END $$;
CREATE POLICY "Users can insert own supplier savings alerts"
ON public.supplier_savings_alerts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- updated_at trigger helper exists (public.update_updated_at_column)
DROP TRIGGER IF EXISTS trg_supplier_savings_settings_updated_at ON public.supplier_savings_settings;
CREATE TRIGGER trg_supplier_savings_settings_updated_at
BEFORE UPDATE ON public.supplier_savings_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add realtime publication for opportunities (so UI can toast)
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_savings_opportunities;