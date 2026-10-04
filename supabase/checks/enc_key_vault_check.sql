-- Check de la clave de cifrado en Vault (auditoría 2026-10-04): business.enc_key() no la puede llamar nadie desde la
-- API, un cliente no puede cifrar con encrypt_account_password y un admin cifra y descifra ida y vuelta sin pasar la
-- clave. Exige el secreto real account_enc_key y que abra una contraseña ya guardada. Autolimpiante
-- (ROLLBACK). Necesita un admin y un user. Devuelve enc_key_vault_check: OK.
--   supabase db query --linked -f supabase/checks/enc_key_vault_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_cliente uuid;
  v_cifrada text;
  v_bloqueado boolean := false;
begin
  -- Con el secreto real: tiene que existir y abrir una contraseña ya guardada (no una cifrada por este check).
  assert exists (select 1 from vault.secrets where name = 'account_enc_key'), 'falta el secreto account_enc_key en Vault';
  select a.password_enc into v_cifrada from business.account a where a.password_enc is not null order by a.id limit 1;
  if v_cifrada is not null then
    perform extensions.pgp_sym_decrypt(decode(v_cifrada, 'base64'), business.enc_key());
  end if;

  assert not has_function_privilege('anon', 'business.enc_key()', 'execute'), 'anon no debe poder llamar enc_key';
  assert not has_function_privilege('authenticated', 'business.enc_key()', 'execute'), 'authenticated no debe poder llamar enc_key';
  assert not has_function_privilege('service_role', 'business.enc_key()', 'execute'), 'service_role no debe poder llamar enc_key';
  assert not has_function_privilege('anon', 'business.encrypt_account_password(text)', 'execute'), 'anon no debe poder cifrar';

  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'user' order by ur.id limit 1;
  assert v_admin is not null and v_cliente is not null, 'faltan admin o user';

  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform business.encrypt_account_password('x');
  exception when insufficient_privilege then
    v_bloqueado := true;
  end;
  reset role;
  assert v_bloqueado, 'un cliente no debe poder cifrar';

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_cifrada := business.encrypt_account_password('clave-de-prueba');
  reset role;
  assert v_cifrada is not null, 'el admin debe poder cifrar';
  assert extensions.pgp_sym_decrypt(decode(v_cifrada, 'base64'), business.enc_key()) = 'clave-de-prueba', 'ida y vuelta con la clave del Vault';

  set local role authenticated;
  perform business.guardar_licencias_cache('[]');
  assert (select datos from business.leer_licencias_cache()) = '[]', 'cache de licencias ida y vuelta';
  reset role;
end
$$;

select 'enc_key_vault_check: OK' as resultado;
rollback;
