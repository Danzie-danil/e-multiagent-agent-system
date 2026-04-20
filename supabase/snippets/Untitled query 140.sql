-- supabase/seed.sql
-- This seed file is executed after migrations when running 'supabase start'

-- 1. Create a Primary Tenant
INSERT INTO public.tenants (id, name, status)
VALUES ('74889c2c-8096-4876-9d3e-953e0593630f', 'e-WAKALA Platform', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 2. Create foundational users for local testing
-- PASSWORDS ARE: password123

-- 2. Create foundational users for local testing
-- PASSWORDS ARE: password123

-- DISABLE TRIGGERS for seeding
SET session_replication_role = 'replica';

-- 2.1 Platform Admin
DO $$
DECLARE target_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@ewakala.dev') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,is_sso_user,last_sign_in_at,created_at,updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000',target_id,'authenticated','authenticated','admin@ewakala.dev',extensions.crypt('password123', extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"role":"PLATFORM_ADMIN"}',false,false,now(),now(),now());
    INSERT INTO public.users (id, tenant_id, role) VALUES (target_id, '74889c2c-8096-4876-9d3e-953e0593630f', 'PLATFORM_ADMIN');
  END IF;
END $$;

-- 2.2 Tenant Admin
DO $$
DECLARE target_id UUID := '00000000-0000-0000-0000-000000001001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'tenant@ewakala.dev') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,is_sso_user,last_sign_in_at,created_at,updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000',target_id,'authenticated','authenticated','tenant@ewakala.dev',extensions.crypt('password123', extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"role":"TENANT_ADMIN"}',false,false,now(),now(),now());
    INSERT INTO public.users (id, tenant_id, role) VALUES (target_id, '74889c2c-8096-4876-9d3e-953e0593630f', 'TENANT_ADMIN');
  END IF;
END $$;

-- 2.3 Super Agent
DO $$
DECLARE target_id UUID := '00000000-0000-0000-0000-000000002001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'superagent@ewakala.dev') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,is_sso_user,last_sign_in_at,created_at,updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000',target_id,'authenticated','authenticated','superagent@ewakala.dev',extensions.crypt('password123', extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"role":"SUPER_AGENT"}',false,false,now(),now(),now());
    INSERT INTO public.users (id, tenant_id, role) VALUES (target_id, '74889c2c-8096-4876-9d3e-953e0593630f', 'SUPER_AGENT');
  END IF;
END $$;

-- 2.4 Agent POS
DO $$
DECLARE target_id UUID := '00000000-0000-0000-0000-000000003001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'agent@ewakala.dev') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,is_sso_user,last_sign_in_at,created_at,updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000',target_id,'authenticated','authenticated','agent@ewakala.dev',extensions.crypt('password123', extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"role":"AGENT"}',false,false,now(),now(),now());
    INSERT INTO public.users (id, tenant_id, role) VALUES (target_id, '74889c2c-8096-4876-9d3e-953e0593630f', 'AGENT');
  END IF;
END $$;

-- RE-ENABLE TRIGGERS
SET session_replication_role = 'origin';
