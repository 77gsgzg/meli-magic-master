
-- 1) De-dup any existing duplicates (safety; audit showed 0 rows but idempotent)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, endpoint
           ORDER BY window_start DESC, created_at DESC, id
         ) AS rn
  FROM public.rate_limit_tracking
)
DELETE FROM public.rate_limit_tracking r
USING ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

-- 2) Add real UNIQUE constraint to make ON CONFLICT (user_id, endpoint) valid
ALTER TABLE public.rate_limit_tracking
  DROP CONSTRAINT IF EXISTS rate_limit_tracking_user_endpoint_key;
ALTER TABLE public.rate_limit_tracking
  ADD CONSTRAINT rate_limit_tracking_user_endpoint_key UNIQUE (user_id, endpoint);

-- 3) Atomic check+increment RPC. Serializes concurrent callers on the same
-- (user_id, endpoint) row via SELECT ... FOR UPDATE inside a plpgsql function.
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max integer,
  p_window_seconds integer DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.rate_limit_tracking%ROWTYPE;
  v_now timestamptz := now();
  v_window_expires_at timestamptz;
  v_retry_after integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'unauthenticated');
  END IF;
  IF p_endpoint IS NULL OR length(btrim(p_endpoint)) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'invalid_endpoint');
  END IF;
  IF p_max IS NULL OR p_max <= 0 OR p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'invalid_limit');
  END IF;

  -- Ensure a row exists so we can lock it.
  INSERT INTO public.rate_limit_tracking (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 0, v_now)
  ON CONFLICT (user_id, endpoint) DO NOTHING;

  -- Lock the row for this (user, endpoint). Serializes concurrent callers.
  SELECT * INTO v_row
    FROM public.rate_limit_tracking
    WHERE user_id = p_user_id AND endpoint = p_endpoint
    FOR UPDATE;

  -- Window expired -> reset atomically.
  IF v_row.window_start < v_now - make_interval(secs => p_window_seconds) THEN
    UPDATE public.rate_limit_tracking
      SET request_count = 1, window_start = v_now
      WHERE user_id = p_user_id AND endpoint = p_endpoint;
    RETURN jsonb_build_object(
      'allowed', true,
      'count', 1,
      'remaining', p_max - 1,
      'window_start', v_now,
      'window_seconds', p_window_seconds
    );
  END IF;

  -- Limit reached -> reject without incrementing (no over-count).
  IF v_row.request_count >= p_max THEN
    v_window_expires_at := v_row.window_start + make_interval(secs => p_window_seconds);
    v_retry_after := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_expires_at - v_now)))::int);
    RETURN jsonb_build_object(
      'allowed', false,
      'count', v_row.request_count,
      'remaining', 0,
      'retry_after_seconds', v_retry_after,
      'window_start', v_row.window_start,
      'window_seconds', p_window_seconds
    );
  END IF;

  -- Under limit -> increment atomically.
  UPDATE public.rate_limit_tracking
    SET request_count = request_count + 1
    WHERE user_id = p_user_id AND endpoint = p_endpoint;

  RETURN jsonb_build_object(
    'allowed', true,
    'count', v_row.request_count + 1,
    'remaining', p_max - v_row.request_count - 1,
    'window_start', v_row.window_start,
    'window_seconds', p_window_seconds
  );
END;
$$;

-- Only trusted backend callers (edge functions using the service role) may
-- invoke this. User identity is validated server-side before calling.
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(uuid, text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid, text, integer, integer) TO service_role;

COMMENT ON FUNCTION public.check_and_increment_rate_limit(uuid, text, integer, integer) IS
  'Atomic rate limit check+increment. Locks the (user_id, endpoint) row FOR UPDATE, resets on window expiry, and returns {allowed, count, remaining, retry_after_seconds}. Callers must pass a trusted p_user_id derived from a validated JWT.';
