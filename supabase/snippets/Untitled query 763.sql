-- 1. CLEANUP LEGACY AUTH
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DELETE FROM auth.users WHERE email IN ('admin@ewakala.dev', 'superagent@ewakala.dev', 'agent@ewakala.dev');

-- 2. REBUILD PUBLIC
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. CORE TABLE
CREATE TABLE public.users (
  id     UUID PRIMARY KEY,
  role   TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE'
);

-- 4. SYNC LOGIC
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'role', 'AGENT'))
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. THE PERFECT SEED
INSERT INTO auth.users (
    instance_id, id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at, last_sign_in_at
)
VALUES 
(
    '00000000-0000-0000-0000-000000000000', 
    '00000000-0000-0000-0000-000000003001', 
    'agent@ewakala.dev', 
    extensions.crypt('password123', extensions.gen_salt('bf', 10)), 
    now(), 
    '{"provider":"email","providers":["email"]}'::jsonb, 
    '{"role":"AGENT"}'::jsonb, 
    'authenticated', 
    'authenticated',
    now(), now(), now()
);

-- (Adding the others just in case you need them)
INSERT INTO auth.users (instance_id, id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at, last_sign_in_at)
VALUES 
('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'admin@ewakala.dev', extensions.crypt('password123', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"PLATFORM_ADMIN"}'::jsonb, 'authenticated', 'authenticated', now(), now(), now()),
('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000002001', 'superagent@ewakala.dev', extensions.crypt('password123', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"SUPER_AGENT"}'::jsonb, 'authenticated', 'authenticated', now(), now(), now());
