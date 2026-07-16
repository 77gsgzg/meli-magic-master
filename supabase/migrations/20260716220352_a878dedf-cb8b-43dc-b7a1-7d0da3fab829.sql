
-- 1. Explicit deny of INSERT/UPDATE/DELETE on cron_job_logs for anon + authenticated.
--    RLS already blocks writes with no policy, but this makes intent explicit
--    and future-proofs against accidental permissive policies.
DROP POLICY IF EXISTS "No client inserts on cron_job_logs" ON public.cron_job_logs;
CREATE POLICY "No client inserts on cron_job_logs"
  ON public.cron_job_logs FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "No client updates on cron_job_logs" ON public.cron_job_logs;
CREATE POLICY "No client updates on cron_job_logs"
  ON public.cron_job_logs FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes on cron_job_logs" ON public.cron_job_logs;
CREATE POLICY "No client deletes on cron_job_logs"
  ON public.cron_job_logs FOR DELETE TO anon, authenticated
  USING (false);

-- Also revoke direct table-level write grants (only service_role and admins should write).
REVOKE INSERT, UPDATE, DELETE ON public.cron_job_logs FROM anon, authenticated;

-- 2. Restrict EXECUTE on SECURITY DEFINER functions that must never be called
--    directly by clients. `has_role` is intentionally left executable because
--    RLS policies invoke it as authenticated.
REVOKE EXECUTE ON FUNCTION public.revoke_ml_token_for_user(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_locked_order_changes()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_order_wallet_debit(uuid)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_add_credit(uuid, numeric, text)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_tickets_guard()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                            FROM PUBLIC, anon, authenticated;

-- Ensure service_role retains execute (edge functions call these).
GRANT EXECUTE ON FUNCTION public.revoke_ml_token_for_user(uuid)         TO service_role;
GRANT EXECUTE ON FUNCTION public.process_order_wallet_debit(uuid)       TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_add_credit(uuid, numeric, text) TO service_role;
