-- Recreate the existing signup provisioning function with explicit diagnostics.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE LOG '[signup] handle_new_user start user_id=% email=%', NEW.id, NEW.email;

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = now();
  RAISE LOG '[profile] profile ensured user_id=%', NEW.id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RAISE LOG '[user_roles] default role ensured user_id=%', NEW.id;

  IF lower(NEW.email) = 'farmatgu@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
    RAISE LOG '[user_roles] admin role ensured user_id=%', NEW.id;
  END IF;

  INSERT INTO public.user_plans (user_id, plan_type, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RAISE LOG '[signup] default plan ensured user_id=%', NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[signup] handle_new_user failed user_id=% sqlstate=% error=%', NEW.id, SQLSTATE, SQLERRM;
  RAISE;
END;
$function$;

-- Restore the expected signup trigger if it is missing in the remixed backend.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill current users in case any were created while the trigger was missing.
INSERT INTO public.profiles (id, full_name)
SELECT u.id, u.raw_user_meta_data ->> 'full_name'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'farmatgu@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_plans (user_id, plan_type, status)
SELECT u.id, 'free'::public.plan_type, 'active'::public.plan_status
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;