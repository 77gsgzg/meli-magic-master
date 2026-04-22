-- ============================================================
-- 1. STORAGE: prefix-based owner-only listing
-- ============================================================

-- Drop the wide-open public SELECT policies that allow ANY caller (incl. anon)
-- to list every object in product-images via storage.objects.
-- Direct file download keeps working because the bucket is public (CDN path).
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "product-images public read" ON storage.objects;

-- Authenticated owner can SELECT/list ONLY their own folder (prefix = uid)
CREATE POLICY "product-images owner list own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can list everything for moderation
CREATE POLICY "product-images admin list all"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin')
);

-- ============================================================
-- 2. SUPPORT TICKETS: tighten ownership rules
-- ============================================================

-- Owner-only INSERT (already enforced, but make it explicit/idempotent)
DROP POLICY IF EXISTS "Users create own tickets" ON public.support_tickets;
CREATE POLICY "Users create own tickets"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Owner can UPDATE their own ticket but CANNOT change admin-only columns
-- (admin_reply / replied_by / replied_at). Admin policy below handles those.
DROP POLICY IF EXISTS "Users update own tickets" ON public.support_tickets;
CREATE POLICY "Users update own tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger to block users from tampering with admin_reply or owner field
CREATE OR REPLACE FUNCTION public.support_tickets_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass field-level guard
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Non-admin: block admin-only fields and ownership change
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'forbidden: cannot change ticket owner';
  END IF;
  IF NEW.admin_reply IS DISTINCT FROM OLD.admin_reply
     OR NEW.replied_by IS DISTINCT FROM OLD.replied_by
     OR NEW.replied_at IS DISTINCT FROM OLD.replied_at THEN
    RAISE EXCEPTION 'forbidden: only admins can set reply fields';
  END IF;
  -- Allowed: subject/message edits while ticket is still open, and status -> closed by owner
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'forbidden: ticket is closed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_guard_trg ON public.support_tickets;
CREATE TRIGGER support_tickets_guard_trg
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.support_tickets_guard();

-- ============================================================
-- 3. ADMIN AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL,
  target_user_id UUID,
  action TEXT NOT NULL,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx
  ON public.admin_audit_logs(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx
  ON public.admin_audit_logs(action, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins view audit logs"
ON public.admin_audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- INSERT only via service role (edge functions). No public/authenticated insert policy.
