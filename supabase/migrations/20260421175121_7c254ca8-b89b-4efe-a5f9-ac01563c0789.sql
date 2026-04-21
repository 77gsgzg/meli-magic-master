-- ============ USER PLANS ============
CREATE TYPE public.plan_type AS ENUM ('free', 'pro', 'premium');
CREATE TYPE public.plan_status AS ENUM ('active', 'expired', 'canceled');

CREATE TABLE public.user_plans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type public.plan_type NOT NULL DEFAULT 'free',
  status public.plan_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own plan"
  ON public.user_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all plans"
  ON public.user_plans FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage plans"
  ON public.user_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_plans_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill existing users
INSERT INTO public.user_plans (user_id, plan_type, status)
SELECT id, 'free', 'active' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Update handle_new_user to create default plan
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  IF lower(NEW.email) = 'farmatgu@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_plans (user_id, plan_type, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ============ SUPPORT TICKETS ============
CREATE TYPE public.ticket_status AS ENUM ('open', 'answered', 'closed');

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 5000),
  admin_reply TEXT CHECK (admin_reply IS NULL OR length(admin_reply) BETWEEN 1 AND 5000),
  status public.ticket_status NOT NULL DEFAULT 'open',
  replied_by UUID REFERENCES auth.users(id),
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update tickets"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();