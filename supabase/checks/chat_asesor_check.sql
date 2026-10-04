-- Check del chat cliente ↔ asesor y de la caché de licencias. Autolimpiante: corre en una transacción que termina en
-- ROLLBACK. Falla con ERROR si algo no se cumple; si todo pasa devuelve 'chat_asesor_check: OK'.
-- Usa usuarios reales (un admin y dos user).
--   supabase db query --linked -f supabase/checks/chat_asesor_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_cliente uuid;
  v_otro uuid;
  v_pedido_otro bigint;
  v_id bigint;
  n int;
  v_datos text;
begin
  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'user' order by ur.id limit 1;
  select ur.auth_user_id into v_otro from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'user' and ur.auth_user_id <> v_cliente limit 1;
  assert v_admin is not null and v_cliente is not null and v_otro is not null, 'faltan usuarios admin y 2 user para probar';

  insert into business.pedido (cliente_id, total, llave_breb, comprobante_path) values (v_otro, 1, '@check', v_otro || '/check-chat.png')
  returning id into v_pedido_otro;
  insert into business.mensaje_asesor (cliente_id, autor, texto) values (v_otro, 'cliente', 'mensaje del otro');

  -- 1) el cliente escribe; queda como suyo y de autor cliente
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_id := business.enviar_mensaje_asesor('  hola asesor  ');
  select count(*) into n from business.mensaje_asesor where id = v_id and cliente_id = v_cliente and autor = 'cliente' and texto = 'hola asesor';
  assert n = 1, 'el mensaje debe quedar del cliente, recortado';

  -- 2) solo ve los suyos
  select count(*) into n from business.mensaje_asesor where cliente_id <> v_cliente;
  assert n = 0, format('el cliente debe ver solo sus mensajes y ve %s ajenos', n);

  -- 3) no puede citar el pedido de otro, ni mandar vacío
  begin
    perform business.enviar_mensaje_asesor('x', v_pedido_otro);
    assert false, 'no debe aceptar el pedido de otro cliente';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform business.enviar_mensaje_asesor('   ');
    assert false, 'no debe aceptar un mensaje vacío';
  exception when invalid_parameter_value then null;
  end;

  -- 4) no escribe directo (ni se hace pasar por el asesor) ni toca los hilos ni la caché
  begin
    insert into business.mensaje_asesor (cliente_id, autor, texto) values (v_cliente, 'asesor', 'falso');
    assert false, 'el cliente no debe insertar directo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from business.telegram_hilo;
    assert false, 'el cliente no debe leer telegram_hilo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform business.leer_licencias_cache('k');
    assert false, 'el cliente no debe leer la caché de licencias';
  exception when insufficient_privilege then null;
  end;

  -- 5) límite: 10 mensajes en 10 minutos
  -- (descuenta los que el cliente real haya enviado en los últimos 10 minutos)
  select count(*) into n from business.mensaje_asesor where cliente_id = v_cliente and autor = 'cliente' and created_at > now() - interval '10 minutes';
  for i in 1..(10 - n) loop perform business.enviar_mensaje_asesor('m' || i); end loop;
  begin
    perform business.enviar_mensaje_asesor('uno de más');
    assert false, 'debe frenar el mensaje 11 en 10 minutos';
  exception when raise_exception then null;
  end;

  -- 6) marcar leídas solo las respuestas propias
  reset role;
  insert into business.mensaje_asesor (cliente_id, autor, texto) values (v_cliente, 'asesor', 'respuesta'), (v_otro, 'asesor', 'respuesta otro');
  set local role authenticated;
  perform business.marcar_mensajes_leidos();
  reset role;
  select count(*) into n from business.mensaje_asesor where autor = 'asesor' and leido and texto in ('respuesta', 'respuesta otro');
  assert n = 1, format('debe marcar leída solo la respuesta propia y marcó %s', n);

  -- 7) staff: guarda y lee la caché cifrada
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform business.guardar_licencias_cache('[{"texto":"t","vence":null}]', 'clave-check');
  select datos into v_datos from business.leer_licencias_cache('clave-check');
  assert v_datos = '[{"texto":"t","vence":null}]', 'la caché debe volver igual';
  reset role;
  select count(*) into n from business.licencias_cache where datos_enc not like '%texto%';
  assert n = 1, 'la caché debe quedar cifrada';

  -- 7b) staff contesta desde el panel y marca leídos los mensajes del cliente; el cliente no puede usarlas
  set local role authenticated;
  v_id := business.enviar_mensaje_staff(v_cliente, 'respuesta panel', 'panel:check');
  perform business.marcar_leidos_staff(v_cliente);
  reset role;
  select count(*) into n from business.mensaje_asesor where id = v_id and autor = 'asesor' and autor_via = 'panel:check';
  assert n = 1, 'el staff debe poder contestar desde el panel';
  select count(*) into n from business.mensaje_asesor where cliente_id = v_cliente and autor = 'cliente' and not leido;
  assert n = 0, 'abrir la conversación debe marcar leídos los mensajes del cliente';
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform business.enviar_mensaje_staff(v_otro, 'falso');
    assert false, 'un cliente no debe contestar como staff';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 8) el bucket acepta HEIC
  select count(*) into n from storage.buckets where id = 'comprobantes' and 'image/heic' = any (allowed_mime_types);
  assert n = 1, 'el bucket comprobantes debe aceptar image/heic';

  -- 9) adjuntos: el cliente sube a su carpeta del bucket 'chat' y manda una imagen sin texto; no puede subir a otra
  --    carpeta, ni citar un archivo ajeno o inexistente. El staff contesta con una nota de voz en la carpeta del cliente.
  insert into storage.objects (bucket_id, name) values ('chat', v_otro || '/check-otro.png');
  reset role;
  delete from business.mensaje_asesor where cliente_id = v_cliente and autor = 'cliente' and created_at > now() - interval '10 minutes';
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name) values ('chat', v_cliente || '/check.png');
  begin
    insert into storage.objects (bucket_id, name) values ('chat', v_otro || '/check-intruso.png');
    assert false, 'el cliente no debe subir a la carpeta de otro';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from storage.objects where bucket_id = 'chat' and name = v_otro || '/check-otro.png';
  assert n = 0, 'el cliente no debe ver los adjuntos de otro';
  v_id := business.enviar_mensaje_asesor('', null, v_cliente || '/check.png', 'imagen');
  select count(*) into n from business.mensaje_asesor where id = v_id and texto = '' and adjunto_tipo = 'imagen';
  assert n = 1, 'debe aceptar una imagen sin texto';
  begin
    perform business.enviar_mensaje_asesor('x', null, v_otro || '/check-otro.png', 'imagen');
    assert false, 'no debe aceptar el archivo de otro cliente';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform business.enviar_mensaje_asesor('x', null, v_cliente || '/no-existe.png', 'imagen');
    assert false, 'no debe aceptar un archivo que no se subió';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform business.enviar_mensaje_asesor('', null, null, null);
    assert false, 'no debe aceptar un mensaje sin texto ni adjunto';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name) values ('chat', v_cliente || '/check-voz.ogg');
  v_id := business.enviar_mensaje_staff(v_cliente, '', 'panel:check', v_cliente || '/check-voz.ogg', 'audio');
  reset role;
  select count(*) into n from business.mensaje_asesor where id = v_id and autor = 'asesor' and adjunto_tipo = 'audio';
  assert n = 1, 'el staff debe poder contestar con una nota de voz';
end
$$;

select 'chat_asesor_check: OK' as resultado;

rollback;
