-- Check de pedidos Bre-B (crear/aprobar/rechazar, RLS y reservas). Autolimpiante: todo corre en una transaccion que
-- termina en ROLLBACK, no deja filas. Falla con ERROR (y la razon) si algo no se cumple; si todo pasa devuelve
-- 'pedido_check: OK'. Usa usuarios reales (un admin y dos user) y necesita al menos 2 perfiles en catalogo_disponible.
--   supabase db query --linked -f supabase/checks/pedido_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_cliente uuid;
  v_otro uuid;
  v_p1 bigint;
  v_p2 bigint;
  v_pedido bigint;
  v_pedido2 bigint;
  v_llave bigint;
  v_oculta bigint;
  v_total numeric;
  n int;
  v_estado text;
begin
  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'user' order by ur.id limit 1;
  select ur.auth_user_id into v_otro from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'user' and ur.auth_user_id <> v_cliente limit 1;
  assert v_admin is not null and v_cliente is not null and v_otro is not null, 'faltan usuarios admin y 2 user para probar';

  select profile_id into v_p1 from business.catalogo_disponible order by profile_id limit 1;
  select profile_id into v_p2 from business.catalogo_disponible where profile_id <> v_p1 order by profile_id limit 1;
  assert v_p1 is not null and v_p2 is not null, 'faltan 2 perfiles disponibles para probar';
  select sum(precio_venta) into v_total from business.catalogo_disponible where profile_id in (v_p1, v_p2);

  insert into business.llave_breb (nombre, llave) values ('Check', '@check') returning id into v_llave;
  insert into business.llave_breb (nombre, llave, activa) values ('Oculta', '@check-oculta', false) returning id into v_oculta;
  insert into storage.objects (bucket_id, name) values ('comprobantes', v_cliente || '/check.png'), ('comprobantes', v_cliente || '/check2.png'), ('comprobantes', v_otro || '/check.png');

  -- 1) el cliente no puede usar el comprobante de otro
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform business.crear_pedido(array[v_p1], v_otro || '/check.png', v_total);
    assert false, 'no debe aceptar el comprobante de otro cliente';
  exception when invalid_parameter_value then null;
  end;

  -- 1b) si el precio cambio respecto de lo que vio (y transfirio) el cliente, no crea el pedido
  begin
    perform business.crear_pedido(array[v_p1, v_p2], v_cliente || '/check.png', v_total - 1);
    assert false, 'no debe crear el pedido si el total no coincide';
  exception when raise_exception then null;
  end;

  -- 1c) llaves: el cliente no ve las ocultas, no puede pagar a una oculta ni agregar llaves
  select count(*) into n from business.llave_breb where id = v_oculta;
  assert n = 0, 'el cliente no debe ver las llaves ocultas';
  begin
    perform business.crear_pedido(array[v_p1, v_p2], v_cliente || '/check.png', v_total, v_oculta);
    assert false, 'no debe aceptar una llave oculta';
  exception when raise_exception then null;
  end;
  begin
    insert into business.llave_breb (nombre, llave) values ('Falsa', '@falsa');
    assert false, 'el cliente no debe agregar llaves';
  exception when insufficient_privilege then null;
  end;

  -- 2) crea el pedido: total de la base, llave elegida, perfiles reservados y fuera de la Tienda
  v_pedido := business.crear_pedido(array[v_p1, v_p2, v_p1], v_cliente || '/check.png', v_total, v_llave);
  select count(*) into n from business.pedido where id = v_pedido and llave_breb = '@check' and llave_nombre = 'Check';
  assert n = 1, 'el pedido debe guardar la llave elegida y su nombre';
  select count(*) into n from business.catalogo_disponible where profile_id in (v_p1, v_p2);
  assert n = 0, 'los perfiles del pedido no deben seguir en la Tienda';
  select count(*) into n from business.pedido where id = v_pedido and total = v_total and estado = 'pendiente';
  assert n = 1, 'el pedido debe quedar pendiente con el total del catalogo';
  select count(*) into n from business.pedido_item where pedido_id = v_pedido;
  assert n = 2, format('el pedido debe tener 2 items (sin repetidos) y tiene %s', n);

  -- 3) el cliente no aprueba ni escribe directo
  begin
    perform business.aprobar_pedido(v_pedido);
    assert false, 'un cliente no debe poder aprobar';
  exception when insufficient_privilege then null;
  end;
  begin
    update business.pedido set estado = 'aprobado' where id = v_pedido;
    assert false, 'un cliente no debe poder escribir pedidos';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 4) otro cliente no ve el pedido ni puede tomar los perfiles reservados
  perform set_config('request.jwt.claims', json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from business.pedido where id = v_pedido;
  assert n = 0, 'otro cliente no debe ver el pedido';
  select count(*) into n from business.pedido_item where pedido_id = v_pedido;
  assert n = 0, 'otro cliente no debe ver los items';
  begin
    perform business.crear_pedido(array[v_p1], v_otro || '/check.png', (select precio_venta from business.catalogo_disponible where profile_id = v_p1));
    assert false, 'no debe poder pedir un perfil reservado';
  exception when raise_exception then null;
  end;
  reset role;

  -- 4b) el staff no puede sacar un perfil de 'reservado' a mano (doble venta)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update business.profile set estado = 'disponible' where id = v_p1;
    assert false, 'el staff no debe poder cambiar el estado de un perfil reservado';
  exception when raise_exception then null;
  end;
  reset role;

  -- 5) el staff rechaza: los perfiles vuelven a la Tienda; no se puede revisar dos veces
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from business.pedido where id = v_pedido;
  assert n = 1, 'el staff debe ver el pedido';
  perform business.rechazar_pedido(v_pedido, 'no llego el pago');
  begin
    perform business.aprobar_pedido(v_pedido);
    assert false, 'un pedido revisado no debe aprobarse';
  exception when raise_exception then null;
  end;
  reset role;
  select count(*) into n from business.catalogo_disponible where profile_id in (v_p1, v_p2);
  assert n = 2, 'tras rechazar, los perfiles deben volver a la Tienda';

  -- 6) nuevo pedido aprobado por el servidor (Telegram, service_role): perfiles vendidos
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform business.crear_pedido(array[v_p1], v_cliente || '/check.png', (select precio_venta from business.catalogo_disponible where profile_id = v_p1));
    assert false, 'un comprobante no debe respaldar dos pedidos';
  exception when invalid_parameter_value then null;
  end;
  v_pedido2 := business.crear_pedido(array[v_p1], v_cliente || '/check2.png', (select precio_venta from business.catalogo_disponible where profile_id = v_p1));
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  perform business.aprobar_pedido(v_pedido2, 'telegram:check');
  reset role;
  select estado::text into v_estado from business.profile where id = v_p1;
  assert v_estado = 'vendido', format('tras aprobar el perfil debe quedar vendido y quedo %s', v_estado);
  select estado::text into v_estado from business.pedido where id = v_pedido2 and revisado_via = 'telegram:check';
  assert v_estado = 'aprobado', 'el pedido debe quedar aprobado y registrar la via';

  -- 7) anon no ve nada
  set local role anon;
  begin
    select count(*) into n from business.pedido;
    assert n = 0, 'anon no debe ver pedidos';
  exception when insufficient_privilege then null;
  end;
  reset role;
end
$$;

select 'pedido_check: OK' as resultado;

rollback;
