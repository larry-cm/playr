-- Check de business.notificacion (RLS, privilegios y deduplicacion de business.notificar). Autolimpiante: todo corre
-- en una transaccion que termina en ROLLBACK, no deja filas. Falla con ERROR (y la razon) si algo no se cumple;
-- si todo pasa devuelve una fila 'notificacion_check: OK' (sin esa fila no corrio completo).
-- Valida efectos (que filas quedan), no el mecanismo: un intento prohibido puede lanzar error o no hacer nada.
-- Usa usuarios reales: necesita al menos un admin, un manager y un user en security.user_role.
--   supabase db query --linked -f supabase/checks/notificacion_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_manager uuid;
  v_cliente uuid;
  n int;
begin
  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_manager from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'manager' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'user' limit 1;
  assert v_admin is not null and v_manager is not null and v_cliente is not null, 'faltan usuarios admin/manager/user para probar';

  -- 1) notificar deduplica: mismos 4 campos = 1 fila; cambiar cualquiera de los 4 = fila nueva
  perform business.notificar('scraping', 'error', '__check__a', 'm1');
  perform business.notificar('scraping', 'error', '__check__a', 'm1');
  select count(*) into n from business.notificacion where titulo = '__check__a';
  assert n = 1, format('dedupe: esperaba 1 fila y hay %s', n);
  perform business.notificar('scraping', 'error', '__check__a', 'm2');
  perform business.notificar('scraping', 'advertencia', '__check__a', 'm1');
  perform business.notificar('plataforma', 'error', '__check__a', 'm1');
  select count(*) into n from business.notificacion where titulo = '__check__a';
  assert n = 4, format('dedupe: distinto mensaje/tipo/origen debe crear fila; esperaba 4 y hay %s', n);

  -- 2) un cliente (rol user) no ve nada
  perform set_config('request.jwt.claim.sub', v_cliente::text, true);
  set local role authenticated;
  select count(*) into n from business.notificacion where titulo like '\_\_check\_\_%';
  assert n = 0, format('cliente no debe ver notificaciones y ve %s', n);

  -- 3) ...pero puede reportar una falla de la plataforma (notificar es security definer)
  perform business.notificar('plataforma', 'error', '__check__b', 'desde cliente');

  -- 4) ...y no puede insertar directo, ni borrar, ni descartar
  begin
    insert into business.notificacion (origen, tipo, titulo, mensaje) values ('scraping', 'error', '__check__c', 'x');
  exception when insufficient_privilege then null;
  end;
  begin
    delete from business.notificacion where titulo like '\_\_check\_\_%';
  exception when insufficient_privilege then null;
  end;
  begin
    update business.notificacion set exist = false where titulo like '\_\_check\_\_%';
  exception when insufficient_privilege then null;
  end;
  reset role;
  select count(*) into n from business.notificacion where titulo like '\_\_check\_\_%' and exist;
  assert n = 5, format('cliente no debe poder insertar/borrar/descartar: esperaba 5 visibles (4 + 1) y hay %s', n);

  -- 5) admin y manager ven todo
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select count(*) into n from business.notificacion where titulo like '\_\_check\_\_%';
  assert n = 5, format('admin debe ver 5 y ve %s', n);
  reset role;
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  set local role authenticated;
  select count(*) into n from business.notificacion where titulo like '\_\_check\_\_%';
  assert n = 5, format('manager debe ver 5 y ve %s', n);
  reset role;

  -- 6) admin: puede descartar (exist=false), pero no borrar de verdad, ni editar, ni reactivar una descartada
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  update business.notificacion set exist = false where titulo = '__check__a' and origen = 'scraping' and tipo = 'error' and mensaje = 'm1';
  get diagnostics n = row_count;
  assert n = 1, format('admin debe poder descartar 1 y descarto %s', n);
  begin
    delete from business.notificacion where titulo = '__check__a';
  exception when insufficient_privilege then null;
  end;
  begin
    update business.notificacion set titulo = '__check__z' where titulo = '__check__a';
  exception when insufficient_privilege then null;
  end;
  begin
    update business.notificacion set exist = true where titulo = '__check__a' and mensaje = 'm1' and origen = 'scraping' and tipo = 'error';
  exception when insufficient_privilege then null;
  end;
  reset role;
  select count(*) into n from business.notificacion where titulo = '__check__a';
  assert n = 4, format('descartar es soft-delete y no se puede borrar/renombrar: esperaba 4 filas y hay %s', n);
  select count(*) into n from business.notificacion where titulo = '__check__a' and exist;
  assert n = 3, format('la descartada no debe reactivarse: esperaba 3 visibles y hay %s', n);

  -- 7) si la falla se repite tras descartarla, vuelve a avisar (la descartada ya no cuenta para deduplicar)
  perform business.notificar('scraping', 'error', '__check__a', 'm1');
  select count(*) into n from business.notificacion where titulo = '__check__a' and exist;
  assert n = 4, format('tras descartar y repetirse la falla deben quedar 4 visibles y hay %s', n);
  select count(*) into n from business.notificacion where titulo = '__check__a';
  assert n = 5, format('deben quedar 5 filas en total (1 descartada) y hay %s', n);

  -- 8) anon no puede crear avisos
  set local role anon;
  begin
    perform business.notificar('scraping', 'error', '__check__d', 'x');
  exception when insufficient_privilege then null;
  end;
  reset role;
  select count(*) into n from business.notificacion where titulo = '__check__d';
  assert n = 0, 'anon no debe poder crear notificaciones';

  -- 9) tipos info y exito (migracion 20260920160001): se crean y deduplican como los demas
  perform business.notificar('scraping', 'info', '__check__e', 'x');
  perform business.notificar('scraping', 'info', '__check__e', 'x');
  perform business.notificar('scraping', 'exito', '__check__e', 'x');
  perform business.notificar('scraping', 'exito', '__check__e', 'x');
  select count(*) into n from business.notificacion where titulo = '__check__e';
  assert n = 2, format('info y exito deben crear 1 fila cada uno (dedupe) y hay %s', n);
end
$$;

rollback;

select 'notificacion_check: OK' as resultado;
