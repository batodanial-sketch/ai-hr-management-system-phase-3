-- Provision each newly created Supabase Auth user into a new tenant.
-- Signup must never implicitly attach an account to an existing organization's
-- data. A same-user owner membership is created atomically with the new org.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  organization_name TEXT;
  organization_slug TEXT;
  new_organization_id UUID;
BEGIN
  organization_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'organization_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    split_part(COALESCE(NULLIF(NEW.email, ''), 'Workspace'), '@', 1) || '''s workspace'
  );

  organization_slug := trim(both '-' from regexp_replace(
    lower(left(split_part(COALESCE(NULLIF(NEW.email, ''), 'user'), '@', 1), 48)),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
  IF organization_slug = '' THEN
    organization_slug := 'workspace';
  END IF;
  organization_slug := organization_slug || '-' || substring(NEW.id::TEXT, 1, 8);

  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations (name, slug)
  VALUES (organization_name, organization_slug)
  RETURNING id INTO new_organization_id;

  INSERT INTO public.memberships (user_id, organization_id, role)
  VALUES (NEW.id, new_organization_id, 'owner')
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
