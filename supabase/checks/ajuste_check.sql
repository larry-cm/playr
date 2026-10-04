-- Check de business.ajuste (RLS y privilegios). Autolimpiante: todo corre en una transaccion que termina en ROLLBACK,
-- no deja filas. Falla con ERROR (y la razon) si algo no se cumple; si todo pasa devuelve 'ajuste_check: OK'.
-- Valida efectos (que filas quedan), no el mecanismo: un intento prohibido puede lanzar error o no hacer nada.
-- Usa usuarios reales: necesita al menos un admin, un manager y un user en security.user_role.
--   supabase db query --linked -f supabase/checks/ajuste_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_manager uuid;
  v_cliente uuid;
  n int;
  v text;
begin
  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_manager from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'manager' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'user' limit 1;
  assert v_admin is not null and v_manager is not null and v_cliente is not null, 'faltan usuarios admin/manager/user para probar';

  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- 1) admin crea y edita; la base sella updated_by con quien lo hizo
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  insert into business.ajuste (clave, valor, updated_by) values ('zz_check', '+570000000001', v_cliente);
  update business.ajuste set valor = '+570000000002' where clave = 'zz_check';
  get diagnostics n = row_count;
  assert n = 1, format('admin debe poder editar 1 y edito %s', n);
  reset role;
  select count(*) into n from business.ajuste where clave = 'zz_check' and valor = '+570000000002' and updated_by = v_admin;
  assert n = 1, 'admin debe crear/editar y updated_by debe ser el admin (no lo que mando el cliente)';

  -- 2) cliente lee pero no crea, edita ni borra
  perform set_config('request.jwt.claim.sub', v_cliente::text, true);
  set local role authenticated;
  select valor into v from business.ajuste where clave = 'zz_check';
  assert v = '+570000000002', 'cliente debe poder leer el ajuste';
  begin
    insert into business.ajuste (clave, valor) values ('zz_check_b', 'x');
  exception when insufficient_privilege then null;
  end;
  begin
    update business.ajuste set valor = 'hack' where clave = 'zz_check';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from business.ajuste where clave = 'zz_check';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 3) manager tampoco escribe (solo admin)
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  set local role authenticated;
  begin
    insert into business.ajuste (clave, valor) values ('zz_check_c', 'x');
  exception when insufficient_privilege then null;
  end;
  begin
    update business.ajuste set valor = 'hack' where clave = 'zz_check';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 4) anon no lee
  set local role anon;
  begin
    select count(*) into n from business.ajuste;
    assert n = 0, 'anon no debe ver ajustes';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 5) ni el admin borra desde la API
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    delete from business.ajuste where clave = 'zz_check';
  exception when insufficient_privilege then null;
  end;
  reset role;

  select count(*) into n from business.ajuste where clave like 'zz\_check%';
  assert n = 1, format('solo debe quedar la fila del admin; hay %s', n);
  select count(*) into n from business.ajuste where clave = 'zz_check' and valor = '+570000000002';
  assert n = 1, 'user/manager no deben poder modificar el ajuste';
end
$$;

rollback;

select 'ajuste_check: OK' as resultado;
