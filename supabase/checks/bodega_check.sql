-- Check del modulo Bodega (migracion 20260920190001): permisos, idempotencia, candado global de compras, maquina de
-- estados y registro atomico/sin duplicados de licencias. Autolimpiante: todo corre en una transaccion que termina en
-- ROLLBACK, no deja filas (ni plataformas, ni cuentas, ni compras). Falla con ERROR (y la razon) si algo no se cumple;
-- si todo pasa devuelve una fila 'bodega_check: OK' (sin esa fila no corrio completo).
-- Necesita al menos un admin, un manager y un user en security.user_role, y algun market_listing.
--   supabase db query --linked -f supabase/checks/bodega_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_manager uuid;
  v_cliente uuid;
  v_listing bigint;
  v_cat bigint;
  v_plat bigint;
  v_key constant text := 'clave-de-prueba-bodega';
  r jsonb;
  c1 bigint;
  c2 bigint;
  n int;
  v_estado business.estado_compra;
begin
  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_manager from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'manager' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'user' limit 1;
  assert v_admin is not null and v_manager is not null and v_cliente is not null, 'faltan usuarios admin/manager/user para probar';
  select id into v_listing from business.market_listing limit 1;
  assert v_listing is not null, 'falta al menos un market_listing para probar';
  select id into v_cat from business.category limit 1;
  insert into business.platform (category_id, nombre) values (v_cat, '__check__plat') returning id into v_plat;

  -- 1) un cliente (rol user): no lee compras, no compra, no registra, no escribe directo
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  perform business.iniciar_compra('00000000-0000-4000-8000-000000000001', v_listing, 2, 1500, 4300);
  reset role;
  perform set_config('request.jwt.claim.sub', v_cliente::text, true);
  set local role authenticated;
  select count(*) into n from business.compra_proveedor;
  assert n = 0, format('cliente no debe ver compras y ve %s', n);
  begin
    perform business.iniciar_compra('00000000-0000-4000-8000-000000000002', v_listing, 1, 1500, 4300);
    assert false, 'cliente no debe poder iniciar compras';
  exception when insufficient_privilege then null;
  end;
  begin
    perform business.registrar_licencias('[]'::jsonb, v_key);
    assert false, 'cliente no debe poder registrar licencias';
  exception when insufficient_privilege then null;
  end;
  begin
    perform business.actualizar_compra(1, 'pagada');
    assert false, 'cliente no debe poder actualizar compras';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 2) ni siquiera un admin escribe la tabla directo: solo las funciones
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    insert into business.compra_proveedor (request_id, listing_id, cantidad, precio_unitario, total, comprador)
    values ('00000000-0000-4000-8000-0000000000aa', v_listing, 1, 1, 1, v_admin);
    assert false, 'admin no debe poder insertar directo';
  exception when insufficient_privilege then null;
  end;
  begin
    update business.compra_proveedor set estado = 'registrada';
    assert false, 'admin no debe poder actualizar directo';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from business.compra_proveedor;
    assert false, 'admin no debe poder borrar';
  exception when insufficient_privilege then null;
  end;

  -- 3) iniciar_compra: calcula el total en la base, guarda quien compro y el saldo; el manager tambien la ve
  reset role;
  select id, estado into c1, v_estado from business.compra_proveedor where request_id = '00000000-0000-4000-8000-000000000001';
  assert v_estado = 'iniciada', 'la compra recien abierta debe estar iniciada';
  select count(*) into n from business.compra_proveedor where id = c1 and total = 3000 and cantidad = 2 and saldo_antes = 4300 and comprador = v_admin;
  assert n = 1, 'total debe ser cantidad*precio (3000), con comprador y saldo_antes';
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  set local role authenticated;
  select count(*) into n from business.compra_proveedor;
  assert n = 1, format('manager debe ver 1 compra y ve %s', n);
  reset role;

  -- 4) idempotencia: mismo request_id = mismo registro, nueva=false, sin fila extra
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  r := business.iniciar_compra('00000000-0000-4000-8000-000000000001', v_listing, 2, 1500, 4300);
  assert (r->>'nueva')::boolean = false, 'repetir el request_id debe devolver nueva=false';
  assert (r->'compra'->>'id')::bigint = c1, 'repetir el request_id debe devolver la misma compra';

  -- 5) candado global: con una 'iniciada' abierta no se puede abrir otra (aunque sea de otro usuario)
  begin
    perform business.iniciar_compra('00000000-0000-4000-8000-000000000003', v_listing, 1, 1500, 4300);
    assert false, 'no debe permitir dos compras en curso';
  exception when raise_exception then
    assert sqlerrm = 'compra_en_curso', format('el error debia ser compra_en_curso y fue: %s', sqlerrm);
  end;
  reset role;
  select count(*) into n from business.compra_proveedor;
  assert n = 1, format('la compra rechazada no debe dejar fila: esperaba 1 y hay %s', n);

  -- 6) maquina de estados: solo transiciones validas
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    perform business.actualizar_compra(c1, 'registrada');
    assert false, 'iniciada -> registrada no es valida';
  exception when raise_exception then
    assert sqlerrm like 'transicion invalida%', format('error inesperado: %s', sqlerrm);
  end;
  perform business.actualizar_compra(c1, 'pagada', 55300, 2800, 'pagada ok');
  perform business.actualizar_compra(c1, 'pendiente_registro', null, null, 'falta 1');
  perform business.actualizar_compra(c1, 'registrada', null, null, 'todo ok');
  begin
    perform business.actualizar_compra(c1, 'pagada');
    assert false, 'registrada -> pagada no es valida';
  exception when raise_exception then null;
  end;
  reset role;
  select count(*) into n from business.compra_proveedor where id = c1 and estado = 'registrada' and pedido_proveedor = 55300 and saldo_despues = 2800 and detalle = 'todo ok';
  assert n = 1, 'la compra debe quedar registrada con pedido, saldo_despues y el ultimo detalle';

  -- 6b) el request_id de una compra ya CERRADA tampoco vuelve a comprar (aqui el candado no ayuda: no hay ninguna iniciada)
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  r := business.iniciar_compra('00000000-0000-4000-8000-000000000001', v_listing, 2, 1500, 4300);
  reset role;
  assert (r->>'nueva')::boolean = false and r->'compra'->>'estado' = 'registrada', format('repetir el request_id de una compra cerrada no debe comprar de nuevo y dio %s', r);
  select count(*) into n from business.compra_proveedor where request_id = '00000000-0000-4000-8000-000000000001';
  assert n = 1, format('el request_id repetido no debe crear otra fila y hay %s', n);

  -- 7) cerrada la anterior, se puede abrir otra; y una 'iniciada' abandonada (>5 min) pasa a 'incierta' y libera el candado
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  r := business.iniciar_compra('00000000-0000-4000-8000-000000000004', v_listing, 1, 1500, 4300);
  assert (r->>'nueva')::boolean, 'tras cerrar la anterior debe poder abrirse otra';
  c2 := (r->'compra'->>'id')::bigint;
  reset role;
  update business.compra_proveedor set created_at = now() - interval '6 minutes' where id = c2;
  set local role authenticated;
  r := business.iniciar_compra('00000000-0000-4000-8000-000000000005', v_listing, 1, 1500, 4300);
  assert (r->>'nueva')::boolean, 'una iniciada abandonada no debe bloquear para siempre';
  reset role;
  select estado into v_estado from business.compra_proveedor where id = c2;
  assert v_estado = 'incierta', format('la abandonada debe quedar incierta y quedo %s', v_estado);

  -- 8) registrar_licencias: crea account + profile, cifra la clave, crea el producto SIN precio (no sale en la Tienda)
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  r := business.registrar_licencias(jsonb_build_array(
    jsonb_build_object('platform_id', v_plat, 'access_type', 'pantalla', 'listing_id', v_listing, 'email', 'a@x.com', 'password', 'secreta1', 'perfil', 'PERFIL 1', 'pin', '1111', 'vence', '2026-10-20', 'costo', 1500),
    jsonb_build_object('platform_id', v_plat, 'access_type', 'pantalla', 'email', 'a@x.com', 'password', 'secreta1', 'perfil', 'PERFIL 2', 'vence', '2026-10-20')
  ), v_key);
  assert (r->>'registradas')::int = 2 and (r->>'duplicadas')::int = 0 and (r->>'productos_creados')::int = 1,
    format('esperaba 2 registradas, 0 duplicadas, 1 producto creado y fue %s', r);
  reset role;
  select count(*) into n from business.account a join business.profile p on p.account_id = a.id
   where a.platform_id = v_plat and a.access_type = 'pantalla' and a.perfil_max = 1 and p.estado = 'disponible' and a.exist and p.exist;
  assert n = 2, format('deben existir 2 cuentas con su perfil disponible y hay %s', n);
  select count(*) into n from business.account where platform_id = v_plat
   and password_enc <> 'secreta1' and extensions.pgp_sym_decrypt(decode(password_enc, 'base64'), v_key) = 'secreta1';
  assert n = 2, 'la clave debe guardarse cifrada y descifrarse con la clave de cifrado';
  select count(*) into n from business.producto where platform_id = v_plat and access_type = 'pantalla' and exist and precio_venta is null;
  assert n = 1, 'debe crearse 1 producto activo sin precio_venta';
  select count(*) into n from business.catalogo_disponible where platform_nombre = '__check__plat';
  assert n = 0, 'sin precio_venta el producto NO debe aparecer en la Tienda';

  -- 9) sin duplicados: repetir la misma entrega no agrega nada (reintentar el registro es seguro)
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  set local role authenticated;
  r := business.registrar_licencias(jsonb_build_array(
    jsonb_build_object('platform_id', v_plat, 'access_type', 'pantalla', 'email', 'A@X.com', 'password', 'otra', 'perfil', 'PERFIL 1', 'vence', '2026-10-20')
  ), v_key);
  assert (r->>'registradas')::int = 0 and (r->>'duplicadas')::int = 1 and (r->>'productos_creados')::int = 0,
    format('repetir debe dar 0 registradas y 1 duplicada (email sin distinguir mayusculas) y fue %s', r);
  -- ...pero el mismo perfil con OTRO vencimiento es una licencia nueva (renovacion): se registra
  r := business.registrar_licencias(jsonb_build_array(
    jsonb_build_object('platform_id', v_plat, 'access_type', 'pantalla', 'email', 'a@x.com', 'password', 'renovada', 'perfil', 'PERFIL 1', 'vence', '2026-11-20')
  ), v_key);
  assert (r->>'registradas')::int = 1, format('una renovacion (otro vencimiento) debe registrarse y fue %s', r);
  reset role;

  -- 10) todo o nada: un grupo invalido revierte tambien a los validos
  select count(*) into n from business.account where platform_id = v_plat;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    perform business.registrar_licencias(jsonb_build_array(
      jsonb_build_object('platform_id', v_plat, 'access_type', 'pantalla', 'email', 'nuevo@x.com', 'password', 'p', 'perfil', 'PERFIL 9', 'vence', '2026-10-20'),
      jsonb_build_object('platform_id', v_plat, 'access_type', 'pantalla', 'email', 'roto@x.com', 'password', 'p')
    ), v_key);
    assert false, 'un grupo sin perfil debe abortar el lote';
  exception when raise_exception then
    assert sqlerrm like 'grupo incompleto%', format('error inesperado: %s', sqlerrm);
  end;
  reset role;
  select count(*) into c1 from business.account where platform_id = v_plat;
  assert c1 = n, 'el lote fallido no debe dejar cuentas a medias';

  -- 11) clave de cifrado invalida y plataforma inexistente abortan
  set local role authenticated;
  begin
    perform business.registrar_licencias('[]'::jsonb, 'corta');
    assert false, 'una clave de cifrado corta debe rechazarse';
  exception when raise_exception then null;
  end;
  begin
    perform business.registrar_licencias(jsonb_build_array(
      jsonb_build_object('platform_id', -1, 'access_type', 'pantalla', 'email', 'a@x.com', 'password', 'p', 'perfil', 'PERFIL 1')
    ), v_key);
    assert false, 'una plataforma inexistente debe rechazarse';
  exception when raise_exception then null;
  end;
  reset role;

  -- 12) un producto eliminado se revive SIN precio (nunca reaparece en la Tienda con el precio viejo), sin duplicar el activo
  update business.producto set exist = false, precio_venta = 9999 where platform_id = v_plat and access_type = 'pantalla';
  set local role authenticated;
  r := business.registrar_licencias(jsonb_build_array(
    jsonb_build_object('platform_id', v_plat, 'access_type', 'pantalla', 'email', 'b@x.com', 'password', 'p', 'perfil', 'PERFIL 3', 'vence', '2026-10-20')
  ), v_key);
  reset role;
  assert (r->>'productos_creados')::int = 1, format('debia revivir el producto y fue %s', r);
  select count(*) into n from business.producto where platform_id = v_plat and access_type = 'pantalla';
  assert n = 1, format('revivir no debe crear una segunda fila y hay %s', n);
  select count(*) into n from business.producto where platform_id = v_plat and access_type = 'pantalla' and exist and precio_venta is null;
  assert n = 1, 'el producto revivido debe quedar activo y sin precio';

  -- 13) anon no llega a nada
  set local role anon;
  begin
    perform business.iniciar_compra('00000000-0000-4000-8000-000000000009', v_listing, 1, 1, 1);
    assert false, 'anon no debe poder iniciar compras';
  exception when insufficient_privilege then null;
  end;
  reset role;
end
$$;

rollback;

select 'bodega_check: OK' as resultado;
