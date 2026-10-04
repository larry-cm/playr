-- Check de 20261005100005_chat_cuota (auditoría 2026-10-04): un cliente sube como mucho 5 archivos del chat sin
-- enviar por día; el staff no tiene tope. Autolimpiante (ROLLBACK). Necesita un admin y un user.
-- Devuelve 'chat_cuota_check: OK'.
--   supabase db query --linked -f supabase/checks/chat_cuota_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_cliente uuid;
  i int;
begin
  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id
    join security.client c on c.id = ur.auth_user_id and c.exist where r.nombre = 'user' order by ur.id limit 1;
  assert v_admin is not null and v_cliente is not null, 'faltan admin o user';

  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  i := 0;
  while business.chat_puede_subir() and i < 60 loop
    i := i + 1;
    insert into storage.objects (bucket_id, name, owner_id) values ('chat', v_cliente || '/check-cuota-' || i || '.webm', v_cliente::text);
  end loop;
  assert i <= 5, 'el cliente no debe poder dejar más de 5 archivos sin enviar';
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('chat', v_cliente || '/check-cuota-extra.webm', v_cliente::text);
    assert false, 'pasado el tope la subida debe rechazarse';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- el staff sube a la carpeta del cliente sin tope
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name, owner_id) values ('chat', v_cliente || '/check-cuota-staff.webm', v_admin::text);
  reset role;
end
$$;

select 'chat_cuota_check: OK' as resultado;
rollback;
