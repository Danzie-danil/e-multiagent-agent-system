DO $$
DECLARE
  new_user_id UUID;
  tenant_id UUID := '74889c2c-8096-4876-9d3e-953e0593630f';
BEGIN
  -- 1. Check if user already exists
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@ewakala.dev';

  -- 2. Create or Update with ALL required system fields
  IF new_user_id IS NULL THEN
    new_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, 
      aud, role, 
      email_confirmed_at, created_at, updated_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, 
      is_super_admin, is_sso_user,
      confirmation_token, email_change_token_new, recovery_token,
      phone, phone_confirmed_at, phone_change, phone_change_token, email_change, email_change_token_current
    )
    VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@ewakala.dev',
      extensions.crypt('password123', extensions.gen_salt('bf')),
      'authenticated', 'authenticated', 
      now(), now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"PLATFORM_ADMIN","name":"System Admin","tenant_name":"e-WAKALA Dev"}',
      false, false,
      '', '', '', -- tokens
      null, null, '', '', '', '' -- phone/email change status
    );
  ELSE
    UPDATE auth.users 
    SET 
      created_at = COALESCE(created_at, now()),
      updated_at = now(),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      last_sign_in_at = COALESCE(last_sign_in_at, now()),
      raw_user_meta_data = '{"role":"PLATFORM_ADMIN","name":"System Admin","tenant_name":"e-WAKALA Dev"}',
      confirmation_token = COALESCE(confirmation_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      recovery_token = COALESCE(recovery_token, ''),
      is_sso_user = COALESCE(is_sso_user, false)
    WHERE id = new_user_id;
  END IF;

  -- 3. Ensure the Public Link exists
  INSERT INTO public.users (id, tenant_id, role)
  VALUES (new_user_id, tenant_id, 'PLATFORM_ADMIN')
  ON CONFLICT (id) DO UPDATE SET role = 'PLATFORM_ADMIN';

  RAISE NOTICE 'Success! The admin account is now fully provisioned.';
END $$;
