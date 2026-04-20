-- ── 1. CLEANUP (Avoiding duplicates) ───────────────────────
DELETE FROM auth.users WHERE email IN ('admin@ewakala.dev', 'superagent@ewakala.dev', 'agent@ewakala.dev');

-- ── 2. CREATE ALL AUTH USERS ────────────────────────────────
-- Passwords are: password123
INSERT INTO auth.users (instance_id, id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES 
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'admin@ewakala.dev', extensions.crypt('password123', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"role":"PLATFORM_ADMIN"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000002001', 'superagent@ewakala.dev', extensions.crypt('password123', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"role":"SUPER_AGENT"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000003001', 'agent@ewakala.dev', extensions.crypt('password123', extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"role":"AGENT"}', 'authenticated', 'authenticated');

-- ── 3. CREATE ALL AUTH IDENTITIES ───────────────────────────
-- This is what unlocks the password login for each user
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES 
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '{"sub":"00000000-0000-0000-0000-000000000001", "email":"admin@ewakala.dev"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000001', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000002001', '{"sub":"00000000-0000-0000-0000-000000002001", "email":"superagent@ewakala.dev"}'::jsonb, 'email', '00000000-0000-0000-0000-000000002001', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000003001', '{"sub":"00000000-0000-0000-0000-000000003001", "email":"agent@ewakala.dev"}'::jsonb, 'email', '00000000-0000-0000-0000-000000003001', now(), now(), now());

-- ── 4. VERIFY PUBLIC PROFILES ────────────────────────────────
-- Making sure the public.users table stays in sync
INSERT INTO public.users (id, role)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'PLATFORM_ADMIN'),
  ('00000000-0000-0000-0000-000000002001', 'SUPER_AGENT'),
  ('00000000-0000-0000-0000-000000003001', 'AGENT')
ON CONFLICT (id) DO NOTHING;
