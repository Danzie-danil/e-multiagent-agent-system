-- supabase/seed.sql
-- This seed file is executed after migrations when running 'supabase start'

-- ── 1. CLEANUP LEGACY AUTH ──────────────────────────────────
-- We purge specific users to prevent conflicts on re-seeding
DELETE FROM auth.users WHERE email IN ('admin@ewakala.dev', 'supervisor@ewakala.dev', 'agent@ewakala.dev');
DELETE FROM auth.identities WHERE identity_data->>'email' IN ('admin@ewakala.dev', 'supervisor@ewakala.dev', 'agent@ewakala.dev');

-- ── 2. SEED USERS (WITH THE GOTRUE NULL FIX) ────────────────
-- Newer versions of Supabase GoTrue crash if these token columns are NULL. We explicitly set them to empty strings.
INSERT INTO auth.users (
  instance_id, id, email, encrypted_password, email_confirmed_at, 
  raw_app_meta_data, raw_user_meta_data, aud, role, 
  created_at, updated_at, last_sign_in_at,
  confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
  email_change, phone_change, phone_change_token, reauthentication_token
)
VALUES 
(
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'admin@ewakala.dev', 
  extensions.crypt('password123', extensions.gen_salt('bf', 10)), now(), 
  '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"PLATFORM_ADMIN"}'::jsonb, 'authenticated', 'authenticated', 
  now(), now(), now(), '', '', '', '', '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000002001', 'supervisor@ewakala.dev', 
  extensions.crypt('password123', extensions.gen_salt('bf', 10)), now(), 
  '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"SUPERVISOR"}'::jsonb, 'authenticated', 'authenticated', 
  now(), now(), now(), '', '', '', '', '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000003001', 'agent@ewakala.dev', 
  extensions.crypt('password123', extensions.gen_salt('bf', 10)), now(), 
  '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"AGENT"}'::jsonb, 'authenticated', 'authenticated', 
  now(), now(), now(), '', '', '', '', '', '', '', ''
);


-- ── 3. SEED IDENTITIES ──────────────────────────────────────
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES 
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '{"sub":"00000000-0000-0000-0000-000000000001", "email":"admin@ewakala.dev"}'::jsonb, 'email', '00000000-0000-0000-0000-000000000001', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000002001', '{"sub":"00000000-0000-0000-0000-000000002001", "email":"supervisor@ewakala.dev"}'::jsonb, 'email', '00000000-0000-0000-0000-000000002001', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000003001', '{"sub":"00000000-0000-0000-0000-000000003001", "email":"agent@ewakala.dev"}'::jsonb, 'email', '00000000-0000-0000-0000-000000003001', now(), now(), now());

-- ── 4. VERIFY PUBLIC PROFILES ───────────────────────────────
-- Note: super_agent_id renamed to supervisor_id
INSERT INTO public.users (id, role, supervisor_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'PLATFORM_ADMIN', NULL),
  ('00000000-0000-0000-0000-000000002001', 'SUPERVISOR', NULL),
  ('00000000-0000-0000-0000-000000003001', 'AGENT', '00000000-0000-0000-0000-000000002001')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, supervisor_id = EXCLUDED.supervisor_id;

-- ── 5. SEED MOCK NOTIFICATIONS ──────────────────────────────
INSERT INTO public.notifications (user_id, type, title, message, is_read, metadata)
VALUES
  -- Platform Admin Auth
  ('00000000-0000-0000-0000-000000000001', 'FRAUD', 'High Risk Transaction Detected', 'Agent Fatuma Ally attempted a suspicious transfer of TZS 2M. Risk score: 0.9.', false, '{"agent_id":"fatuma-uuid"}'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'SYSTEM', 'M-Pesa API Outage', 'Connection to M-Pesa node 2 is experiencing high latency.', true, '{}'::jsonb),

  -- Supervisor Auth
  ('00000000-0000-0000-0000-000000002001', 'LIQUIDITY', 'NMB Float Warning', 'Your agent Juma Hassan has fallen below 20% safe float threshold for NMB.', false, '{"wallet":"NMB"}'::jsonb),
  ('00000000-0000-0000-0000-000000002001', 'COMMISSION', 'Daily Earning Report', 'You earned TZS 45,000 in supervisor commissions today.', true, '{}'::jsonb),

  -- Agent Auth
  ('00000000-0000-0000-0000-000000003001', 'TRANSACTION', 'Deposit Successful', 'TZS 50,000 has been credited to your CRDB wallet.', false, '{"wallet":"CRDB"}'::jsonb);
