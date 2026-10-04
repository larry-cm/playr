-- Check del pago por QR desde el chat (20261006100001 + 20261006100002): pedido sin comprobante que espera, mensaje
-- automático del asesor con el QR y el monto, un solo pedido abierto contando los dos estados, entrega del comprobante
-- por el chat (el primero gana), rechazo de un pedido que espera (libera los perfiles), aprobación solo con comprobante
-- y PDF ('documento') en el chat. Autolimpiante: todo corre en una transacción que termina en ROLLBACK, no deja filas.
-- Falla con ERROR (y la razón) si algo no se cumple; si todo pasa devuelve 'pedido_qr_check: OK'.
-- Usa usuarios reales (un admin y dos user, el primero activo y sin pedidos abiertos) y 2 perfiles en
-- catalogo_disponible.
--   supabase db query --linked -f supabase/checks/pedido_qr_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_cliente uuid;
  v_otro uuid;
  v_p1 bigint;
  v_p2 bigint;
  v_total numeric;
  v_llave bigint;
  v_qr text;
  v_monto text;
  v_pedido bigint;
  v_pedido2 bigint;
  v_msg bigint;
  v_sin_pedido int;
  n int;
  v_estado text;
begin
  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id
    join security.client c on c.id = ur.auth_user_id and c.exist where r.nombre = 'user'
    and not exists (select 1 from business.pedido pe where pe.cliente_id = ur.auth_user_id
                    and pe.estado in ('pendiente', 'esperando_comprobante'))
    order by ur.id limit 1;
  select ur.auth_user_id into v_otro from security.user_role ur join security.role r on r.id = ur.role_id
    where r.nombre = 'user' and ur.auth_user_id <> v_cliente limit 1;
  assert v_admin is not null and v_cliente is not null and v_otro is not null, 'faltan usuarios admin y 2 user para probar';

  select profile_id into v_p1 from business.catalogo_disponible order by profile_id limit 1;
  select profile_id into v_p2 from business.catalogo_disponible where profile_id <> v_p1 order by profile_id limit 1;
  assert v_p1 is not null and v_p2 is not null, 'faltan 2 perfiles disponibles para probar';
  select sum(precio_venta) into v_total from business.catalogo_disponible where profile_id in (v_p1, v_p2);

  insert into business.llave_breb (nombre, llave) values ('Check QR', '@check-qr') returning id into v_llave;
  v_qr := v_llave || '/check-qr.png';
  update business.llave_breb set qr_path = v_qr where id = v_llave;
  insert into storage.objects (bucket_id, name, metadata) values
    ('comprobantes', v_cliente || '/check-qr.pdf', '{"mimetype": "application/pdf"}'),
    ('comprobantes', v_cliente || '/check-qr-2.png', '{"mimetype": "image/png"}'),
    ('comprobantes', v_otro || '/check-qr.png', '{"mimetype": "image/png"}'),
    ('chat', v_cliente || '/check-qr-doc.pdf', '{"mimetype": "application/pdf"}');

  -- 0a) monto en pesos con separador de miles colombiano
  assert business.formato_cop(25000) = '25.000', 'formato_cop(25000) debe ser 25.000: ' || business.formato_cop(25000);
  assert business.formato_cop(1234567.5) = '1.234.567,50', 'formato_cop con centavos: ' || business.formato_cop(1234567.5);
  v_monto := business.formato_cop(v_total);

  -- 0) un pedido pendiente sin comprobante no se puede guardar ni a mano
  begin
    insert into business.pedido (cliente_id, estado, total, llave_breb) values (v_otro, 'pendiente', 1, '@check-qr');
    assert false, 'un pedido pendiente debe tener comprobante';
  exception when check_violation then null;
  end;

  -- 1) el cliente crea el pedido por QR: espera comprobante, perfiles apartados, mensaje automático con QR y monto
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform business.crear_pedido_qr(array[v_p1, v_p2], v_total - 1, v_llave);
    assert false, 'no debe crear el pedido si el total no coincide';
  exception when raise_exception then
    assert sqlerrm like 'El precio cambió%', 'debe cortarse por el precio: ' || sqlerrm;
  end;

  v_pedido := business.crear_pedido_qr(array[v_p1, v_p2, v_p1], v_total, v_llave);
  select count(*) into n from business.pedido
  where id = v_pedido and estado = 'esperando_comprobante' and comprobante_path is null and total = v_total
    and llave_breb = '@check-qr' and llave_nombre = 'Check QR';
  assert n = 1, 'el pedido debe quedar esperando comprobante, sin comprobante, con el total y la llave elegida';
  select count(*) into n from business.pedido_item where pedido_id = v_pedido;
  assert n = 2, format('el pedido debe tener 2 items (sin repetidos) y tiene %s', n);
  select count(*) into n from business.catalogo_disponible where profile_id in (v_p1, v_p2);
  assert n = 0, 'los perfiles del pedido no deben seguir en la Tienda';
  select count(*) into n from business.mensaje_asesor
  where cliente_id = v_cliente and pedido_id = v_pedido and autor = 'asesor' and not leido
    and adjunto_bucket = 'llaves-qr' and adjunto_path = v_qr and adjunto_tipo = 'imagen'
    and texto like '%$' || v_monto || '%' and texto like '%@check-qr%';
  assert n = 1, 'el cliente debe ver el mensaje automático del asesor, sin leer, con el QR, el monto y la llave';

  -- 2) un solo pedido abierto: ni otro por QR ni uno con comprobante
  begin
    perform business.crear_pedido_qr(array[v_p1], v_total, v_llave);
    assert false, 'no debe aceptar un segundo pedido abierto por QR';
  exception when raise_exception then
    assert sqlerrm like 'Ya tienes un pedido esperando el comprobante%', 'debe cortarse por el pedido que espera: ' || sqlerrm;
  end;
  begin
    perform business.crear_pedido(array[v_p1], v_cliente || '/check-qr-2.png', v_total, v_llave);
    assert false, 'no debe aceptar un pedido con comprobante mientras otro espera';
  exception when raise_exception then
    assert sqlerrm like 'Ya tienes un pedido esperando el comprobante%', 'debe cortarse por el pedido que espera: ' || sqlerrm;
  end;
  reset role;

  -- 3) el staff no puede aprobar sin comprobante; sí rechazar, y eso devuelve los perfiles a la Tienda
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform business.aprobar_pedido(v_pedido);
    assert false, 'no debe aprobarse un pedido sin comprobante';
  exception when raise_exception then
    assert sqlerrm like 'El pedido todavía no tiene comprobante%', 'debe cortarse por falta de comprobante: ' || sqlerrm;
  end;
  perform business.rechazar_pedido(v_pedido, 'no llegó el comprobante');
  reset role;
  select estado::text into v_estado from business.pedido where id = v_pedido and comprobante_path is null;
  assert v_estado = 'rechazado', format('el pedido que esperaba debe quedar rechazado y quedó %s', v_estado);
  select count(*) into n from business.catalogo_disponible where profile_id in (v_p1, v_p2);
  assert n = 2, 'tras rechazar el pedido que esperaba, sus perfiles deben volver a la Tienda';

  -- 4) un pedido rechazado ya no recibe comprobante; uno nuevo sí, solo el primero, y solo con un comprobante propio
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform business.adjuntar_comprobante(v_pedido, v_cliente || '/check-qr.pdf');
    assert false, 'un pedido rechazado no debe recibir comprobante';
  exception when raise_exception then
    assert sqlerrm like 'Este pedido ya no está esperando%', 'debe cortarse por el estado: ' || sqlerrm;
  end;

  v_pedido2 := business.crear_pedido_qr(array[v_p1], (select precio_venta from business.catalogo_disponible where profile_id = v_p1), v_llave);
  reset role;

  -- otro cliente no puede entregar un comprobante (suyo) a un pedido ajeno que espera
  perform set_config('request.jwt.claims', json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform business.adjuntar_comprobante(v_pedido2, v_otro || '/check-qr.png');
    assert false, 'otro cliente no debe entregar comprobantes a un pedido ajeno';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  select count(*) into n from business.pedido where id = v_pedido2 and estado = 'esperando_comprobante';
  assert n = 1, 'el pedido ajeno debe seguir esperando su comprobante';

  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform business.adjuntar_comprobante(v_pedido2, v_otro || '/check-qr.png');
    assert false, 'no debe aceptar el comprobante de otro cliente';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform business.adjuntar_comprobante(v_pedido2, v_cliente || '/no-existe.png');
    assert false, 'no debe aceptar un comprobante que no se subió';
  exception when invalid_parameter_value then null;
  end;

  v_sin_pedido := business.comprobantes_sin_pedido();
  v_msg := business.adjuntar_comprobante(v_pedido2, v_cliente || '/check-qr.pdf');
  select count(*) into n from business.pedido
  where id = v_pedido2 and estado = 'pendiente' and comprobante_path = v_cliente || '/check-qr.pdf';
  assert n = 1, 'con el comprobante el pedido debe pasar a pendiente y guardarlo';
  select count(*) into n from business.mensaje_asesor
  where id = v_msg and cliente_id = v_cliente and pedido_id = v_pedido2 and autor = 'cliente' and not leido
    and adjunto_bucket = 'comprobantes' and adjunto_path = v_cliente || '/check-qr.pdf' and adjunto_tipo = 'documento';
  assert n = 1, 'el comprobante PDF debe quedar como mensaje del cliente en el chat, sin leer para el staff';
  assert business.comprobantes_sin_pedido() = v_sin_pedido - 1, 'el comprobante entregado debe contar como "con pedido"';

  begin
    perform business.adjuntar_comprobante(v_pedido2, v_cliente || '/check-qr-2.png');
    assert false, 'un segundo comprobante no debe pisar el primero';
  exception when raise_exception then
    assert sqlerrm like 'Este pedido ya no está esperando%', 'debe cortarse por el estado: ' || sqlerrm;
  end;
  begin
    perform business.crear_pedido(array[v_p2], v_cliente || '/check-qr-2.png', (select precio_venta from business.catalogo_disponible where profile_id = v_p2), v_llave);
    assert false, 'no debe aceptar otro pedido mientras uno está por verificar';
  exception when raise_exception then
    assert sqlerrm like 'Ya tienes un pago por verificar%', 'debe cortarse por el pendiente: ' || sqlerrm;
  end;

  -- 5) PDF en el chat: 'documento' se acepta; un tipo desconocido no
  v_msg := business.enviar_mensaje_asesor('', null, v_cliente || '/check-qr-doc.pdf', 'documento');
  select count(*) into n from business.mensaje_asesor
  where id = v_msg and adjunto_bucket = 'chat' and adjunto_tipo = 'documento';
  assert n = 1, 'un PDF del chat debe guardarse como documento del bucket chat';
  begin
    perform business.enviar_mensaje_asesor('', null, v_cliente || '/check-qr-doc.pdf', 'video');
    assert false, 'no debe aceptar un tipo de adjunto desconocido';
  exception when invalid_parameter_value then null;
  end;
  reset role;

  -- 6) otro cliente no ve los pedidos ni los mensajes, ni llama la reserva interna
  perform set_config('request.jwt.claims', json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from business.pedido where id in (v_pedido, v_pedido2);
  assert n = 0, 'otro cliente no debe ver los pedidos';
  select count(*) into n from business.mensaje_asesor where cliente_id = v_cliente;
  assert n = 0, 'otro cliente no debe ver los mensajes';
  begin
    perform business.pedido_reservar(v_otro, array[v_p2], 1, v_llave, null);
    assert false, 'un cliente no debe llamar la función interna de reserva';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 7) con el comprobante, el staff aprueba como siempre: el perfil queda vendido
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform business.aprobar_pedido(v_pedido2);
  reset role;
  select estado::text into v_estado from business.profile where id = v_p1;
  assert v_estado = 'vendido', format('tras aprobar el perfil debe quedar vendido y quedó %s', v_estado);
end
$$;

select 'pedido_qr_check: OK' as resultado;

rollback;
