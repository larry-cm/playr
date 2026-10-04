-- Check del registro de compras guardado (migraciones 20261003120001 y 20261003130001): permisos (staff y service_role), fusion por id (gana lo que llega, se conserva
-- lo que no viene), orden fecha desc, origen plataforma/proveedor y sello de sincronizacion. Autolimpiante: todo corre en una
-- transaccion que termina en ROLLBACK, no deja filas. Falla con ERROR (y la razon) si algo no se cumple; si todo pasa
-- devuelve una fila 'historial_proveedor_check: OK' (sin esa fila no corrio completo).
-- Necesita al menos un admin, un manager y un user en security.user_role, algun market_listing y ninguna compra 'iniciada'.
--   supabase db query --linked -f supabase/checks/historial_proveedor_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_manager uuid;
  v_cliente uuid;
  v_listing bigint;
  v_cuenta constant text := encode(sha256(convert_to('__check__.host|check@x.com', 'UTF8')), 'hex');
  r jsonb;
  c1 bigint;
  n int;
  v_sinc timestamptz;
begin
  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_manager from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'manager' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'user' limit 1;
  assert v_admin is not null and v_manager is not null and v_cliente is not null, 'faltan usuarios admin/manager/user para probar';
  select id into v_listing from business.market_listing limit 1;
  assert v_listing is not null, 'falta al menos un market_listing para probar';

  -- una compra hecha desde Bodega con el pedido 990000002 (para probar origen = plataforma)
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  r := business.iniciar_compra('00000000-0000-4000-8000-0000000000c1', v_listing, 1, 1000, 5000);
  c1 := (r->'compra'->>'id')::bigint;
  perform business.actualizar_compra(c1, 'pagada', 990000002, 4000, 'check');
  reset role;

  -- 1) un cliente (rol user) no fusiona ni lee; anon tampoco
  perform set_config('request.jwt.claim.sub', v_cliente::text, true);
  set local role authenticated;
  begin
    perform business.historial_fusionar(v_cuenta, '__check__.host', '[]'::jsonb, true);
    assert false, 'cliente no debe poder fusionar el historial';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform business.historial_fusionar(v_cuenta, '__check__.host', '[]'::jsonb, true);
    assert false, 'anon no debe poder fusionar el historial';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 2) primera fusion (compra desde la plataforma, sin sincronizar): crea la fila, sin sello de sincronizacion
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  set local role authenticated;
  r := business.historial_fusionar(v_cuenta, '__check__.host', jsonb_build_array(
    jsonb_build_object('id', 990000002, 'fecha', '2026-10-02T10:00:00-05:00', 'estado', 'Completado', 'total', 1000, 'articulos', 1,
                       'productos', jsonb_build_array(jsonb_build_object('nombre', 'DESDE LA COMPRA', 'cantidad', 1)))
  ), false);
  assert r->'sincronizado_en' = 'null'::jsonb, format('fusionar sin sincronizar no debe sellar sincronizado_en: %s', r);
  assert jsonb_array_length(r->'pedidos') = 1, format('debia quedar 1 pedido: %s', r);
  assert r->'pedidos'->0->>'origen' = 'plataforma', format('el pedido de una compra de Bodega debe ser origen plataforma: %s', r);

  -- 3) sincronizacion: llega el mismo pedido (corregido por el sitio) y dos mas; lo que llega gana, orden fecha desc
  r := business.historial_fusionar(v_cuenta, '__check__.host', jsonb_build_array(
    jsonb_build_object('id', 990000001, 'fecha', '2026-10-01T09:00:00-05:00', 'estado', 'Completado', 'total', 500, 'articulos', 1, 'productos', '[]'::jsonb),
    jsonb_build_object('id', 990000002, 'fecha', '2026-10-02T10:00:00-05:00', 'estado', 'Completado', 'total', 1000, 'articulos', 1,
                       'productos', jsonb_build_array(jsonb_build_object('nombre', 'DEL SITIO', 'cantidad', 1)), 'origen', 'proveedor'),
    jsonb_build_object('id', 990000003, 'fecha', '2026-10-02T10:00:00-05:00', 'estado', 'Procesando', 'total', 700, 'articulos', 2, 'productos', '[]'::jsonb)
  ), true);
  assert r->'sincronizado_en' <> 'null'::jsonb, format('sincronizar debe sellar sincronizado_en: %s', r);
  assert jsonb_array_length(r->'pedidos') = 3, format('debian quedar 3 pedidos (union por id): %s', r);
  -- misma fecha: desempata id desc
  assert (r->'pedidos'->0->>'id')::bigint = 990000003 and (r->'pedidos'->1->>'id')::bigint = 990000002 and (r->'pedidos'->2->>'id')::bigint = 990000001,
    format('orden esperado 990000003, 990000002, 990000001 y fue %s', r->'pedidos');
  assert r->'pedidos'->1->'productos'->0->>'nombre' = 'DEL SITIO', format('el pedido que llega debe ganar: %s', r->'pedidos'->1);
  assert r->'pedidos'->1->>'origen' = 'plataforma', 'origen lo calcula la base (ignora el que manda el cliente)';
  assert r->'pedidos'->0->>'origen' = 'proveedor' and r->'pedidos'->2->>'origen' = 'proveedor', 'pedidos sin compra de Bodega deben ser origen proveedor';

  -- 4) una fusion que ya no trae los pedidos viejos (corte de 20 paginas) no los borra; fusionar sin sincronizar no toca el sello
  -- (now() es fijo dentro de la transaccion: se envejece el sello para que el cambio se note)
  reset role;
  update business.historial_proveedor set sincronizado_en = now() - interval '2 days' where cuenta = v_cuenta returning sincronizado_en into v_sinc;
  set local role authenticated;
  r :=business.historial_fusionar(v_cuenta, '__check__.host', jsonb_build_array(
    jsonb_build_object('id', 990000004, 'fecha', '2026-10-03T08:00:00-05:00', 'estado', 'Completado', 'total', 900, 'articulos', 1, 'productos', '[]'::jsonb)
  ), false);
  assert jsonb_array_length(r->'pedidos') = 4, format('los pedidos que no vienen se conservan: %s', r);
  assert (r->'pedidos'->0->>'id')::bigint = 990000004, 'el mas nuevo va primero';
  assert (r->>'sincronizado_en')::timestamptz = v_sinc, 'fusionar sin sincronizar no debe cambiar sincronizado_en';

  -- 5) entrada invalida se rechaza
  begin
    perform business.historial_fusionar(v_cuenta, '__check__.host', '[{"fecha": "2026-10-03T08:00:00-05:00"}]'::jsonb, false);
    assert false, 'un pedido sin id debe rechazarse';
  exception when raise_exception then null;
  end;

  -- 6) staff lee la fila; nadie la escribe directo
  select count(*) into n from business.historial_proveedor where cuenta = v_cuenta;
  assert n = 1, format('manager debe ver la fila y ve %s', n);
  begin
    update business.historial_proveedor set pedidos = '[]'::jsonb where cuenta = v_cuenta;
    assert false, 'staff no debe poder actualizar directo';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into business.historial_proveedor (cuenta, host) values (repeat('a', 64), 'x');
    assert false, 'staff no debe poder insertar directo';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from business.historial_proveedor where cuenta = v_cuenta;
    assert false, 'staff no debe poder borrar';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 7) el cliente no ve la fila
  perform set_config('request.jwt.claim.sub', v_cliente::text, true);
  set local role authenticated;
  select count(*) into n from business.historial_proveedor;
  assert n = 0, format('cliente no debe ver el historial y ve %s filas', n);
  reset role;

  -- 8) el job nocturno (clave secreta = service_role, sin usuario) sincroniza (migracion 20261003130001). auth.role() lee
  -- request.jwt.claim.role o, si no esta, request.jwt.claims->>'role' (segun la version): se fijan los dos.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
  set local role service_role;
  r := business.historial_fusionar(v_cuenta, '__check__.host', jsonb_build_array(
    jsonb_build_object('id', 990000005, 'fecha', '2026-10-03T23:00:00-05:00', 'estado', 'Completado', 'total', 300, 'articulos', 1, 'productos', '[]'::jsonb)
  ), true);
  assert jsonb_array_length(r->'pedidos') = 5 and (r->'pedidos'->0->>'id')::bigint = 990000005, format('service_role debe fusionar: %s', r);
  assert (r->>'sincronizado_en')::timestamptz <> v_sinc, 'la sincronizacion del job debe sellar sincronizado_en';
  reset role;
  -- con rol authenticated y claim de otro rol (un cliente) sigue rechazado
  perform set_config('request.jwt.claim.sub', v_cliente::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"role": "authenticated"}', true);
  set local role authenticated;
  begin
    perform business.historial_fusionar(v_cuenta, '__check__.host', '[]'::jsonb, true);
    assert false, 'cliente con claim authenticated no debe poder fusionar el historial';
  exception when insufficient_privilege then null;
  end;
  reset role;
end
$$;

rollback;

select 'historial_proveedor_check: OK' as resultado;
