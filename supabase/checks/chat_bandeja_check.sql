-- Check de la bandeja de mensajes del staff (etiquetas, carpetas, estado por chat, reacciones, fijados, respuestas e
-- insignia de no leídos). Autolimpiante: corre en una transacción que termina en ROLLBACK. Falla con ERROR si algo no se
-- cumple; si todo pasa devuelve 'chat_bandeja_check: OK'.
-- Usa usuarios reales (un admin, dos user con fila en security.client y, para el tope de fijados, hasta 4 clientes más).
-- Necesita lugar libre: como mucho 17 etiquetas y 7 carpetas ya creadas.
--   supabase db query --linked -f supabase/checks/chat_bandeja_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_cliente uuid;
  v_otro uuid;
  v_otro_msg bigint;
  v_m1 bigint;
  v_nuevo bigint;
  v_p1 bigint; v_p2 bigint; v_p3 bigint; v_p4 bigint;
  v_e1 bigint; v_e2 bigint;
  v_c1 bigint; v_c2 bigint; v_c3 bigint;
  v_e0 int; v_f0 int; v_b0 int;
  v_ids bigint[];
  v_uuids uuid[];
  v_u uuid;
  v_sql text;
  v_msg text;
  v_res text;
  v_fila record;
  n int;
begin
  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id
    join security.client c on c.id = ur.auth_user_id where r.nombre = 'user' order by ur.id limit 1;
  select ur.auth_user_id into v_otro from security.user_role ur join security.role r on r.id = ur.role_id
    join security.client c on c.id = ur.auth_user_id where r.nombre = 'user' and ur.auth_user_id <> v_cliente order by ur.id limit 1;
  assert v_admin is not null and v_cliente is not null and v_otro is not null, 'faltan usuarios admin y 2 user (con security.client) para probar';

  -- El cliente real puede haber escrito hace poco: se descuenta para no chocar con su límite de 10 en 10 minutos.
  delete from business.mensaje_asesor where cliente_id = v_cliente and autor = 'cliente' and created_at > now() - interval '10 minutes';

  -- Mensajes de prueba (fechas viejas: no cuentan para el límite de 10 en 10 minutos del cliente real).
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_otro, 'cliente', 'check otro', now() - interval '1 hour')
  returning id into v_otro_msg;
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_cliente, 'cliente', 'check 1', now() - interval '1 hour')
  returning id into v_m1;
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_cliente, 'asesor', 'check resp', now() - interval '1 hour');

  -- 1) El cliente no puede usar las funciones del staff ni anon nada --------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  foreach v_sql in array array[
    'select business.chat_etiqueta_guardar(null, ''x'', ''#3987e5'')',
    'select business.chat_etiqueta_eliminar(1)',
    format('select business.chat_etiquetas_asignar(%L, ''{}'')', v_cliente),
    'select business.chat_carpeta_guardar(null, ''x'', null)',
    'select business.chat_carpeta_eliminar(1)',
    'select business.chat_carpetas_ordenar(''{}'')',
    format('select business.chat_carpeta_chats(1, array[%L]::uuid[])', v_cliente),
    format('select business.chat_carpetas_de_cliente(%L, ''{}'')', v_cliente),
    format('select business.chat_fijar(%L, true)', v_cliente),
    format('select business.chat_archivar(%L, true)', v_cliente),
    format('select business.chat_eliminar(%L)', v_cliente),
    format('select business.chat_marcar_no_leido(%L, true)', v_cliente),
    format('select business.chat_notas_guardar(%L, ''x'')', v_cliente),
    format('select business.marcar_leidos_staff(%L)', v_cliente),
    format('select business.enviar_mensaje_staff(%L, ''x'')', v_otro),
    'select * from business.chat_bandeja_staff()',
    'select business.chat_sin_leer_staff()'
  ] loop
    begin
      execute v_sql;
      raise exception 'el cliente no debe poder: %', v_sql;
    exception when insufficient_privilege then null;
    end;
  end loop;
  reset role;
  set local role anon;
  begin
    perform business.chat_sin_leer_staff();
    raise exception 'anon no debe poder leer la insignia';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 2) Etiquetas -------------------------------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_e0 from business.chat_etiqueta;
  assert v_e0 <= 17, format('hay %s etiquetas: el check necesita lugar para 3', v_e0);
  foreach v_sql in array array[
    'select business.chat_etiqueta_guardar(null, ''   '', ''#3987e5'')',
    format('select business.chat_etiqueta_guardar(null, %L, ''#3987e5'')', repeat('a', 31)),
    'select business.chat_etiqueta_guardar(null, ''Check color'', ''#123456'')',
    'select business.chat_etiqueta_guardar(null, ''Check color'', null)',
    'select business.chat_etiqueta_guardar(-1, ''Check no existe'', ''#3987e5'')'
  ] loop
    begin
      execute v_sql;
      raise exception 'la etiqueta no debe aceptarse: %', v_sql;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  v_e1 := business.chat_etiqueta_guardar(null, E'  Check \n  VIP ', '#3987E5');
  select count(*) into n from business.chat_etiqueta where id = v_e1 and nombre = 'Check VIP' and color = '#3987e5';
  assert n = 1, 'la etiqueta debe quedar con el nombre limpio y el color en minúsculas';
  begin
    perform business.chat_etiqueta_guardar(null, 'check vip', '#d95926');
    raise exception 'no debe aceptar una etiqueta repetida (sin distinguir mayúsculas)';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'Ya existe una etiqueta con ese nombre.', 'mensaje de etiqueta repetida: ' || v_msg;
  end;
  assert business.chat_etiqueta_guardar(v_e1, 'CHECK VIP', '#d95926') = v_e1, 'editar debe devolver el mismo id';
  select count(*) into n from business.chat_etiqueta where id = v_e1 and nombre = 'CHECK VIP' and color = '#d95926';
  assert n = 1, 'la etiqueta debe poder renombrarse a sí misma y cambiar de color';
  v_e2 := business.chat_etiqueta_guardar(null, 'Check Pago', '#199e70');
  for i in 1..(20 - v_e0 - 2) loop
    perform business.chat_etiqueta_guardar(null, 'Check L' || i, '#c98500');
  end loop;
  begin
    perform business.chat_etiqueta_guardar(null, 'Check 21', '#c98500');
    raise exception 'no debe aceptar la etiqueta 21';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'Máximo 20 etiquetas.', 'mensaje del tope de etiquetas: ' || v_msg;
  end;

  perform business.chat_etiquetas_asignar(v_cliente, array[v_e2, v_e1]);
  foreach v_sql in array array[
    format('select business.chat_etiquetas_asignar(%L, array[%s, %s])', v_cliente, v_e1, v_e1),
    format('select business.chat_etiquetas_asignar(%L, array[%s, null])', v_cliente, v_e1),
    format('select business.chat_etiquetas_asignar(%L, array[-1])', v_cliente),
    format('select business.chat_etiquetas_asignar(%L, array[%s])', gen_random_uuid(), v_e1)
  ] loop
    begin
      execute v_sql;
      raise exception 'la asignación no debe aceptarse: %', v_sql;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  select count(*) into n from business.chat_cliente_etiqueta where cliente_id = v_cliente;
  assert n = 2, format('el chat debe quedar con 2 etiquetas y tiene %s', n);

  -- 3) Carpetas --------------------------------------------------------------------------------------------------------
  select count(*) into v_f0 from business.chat_carpeta;
  assert v_f0 <= 7, format('hay %s carpetas: el check necesita lugar para 3', v_f0);
  foreach v_sql in array array[
    'select business.chat_carpeta_guardar(null, '''', null)',
    format('select business.chat_carpeta_guardar(null, %L, null)', repeat('a', 25)),
    format('select business.chat_carpeta_guardar(null, ''Check icono'', %L)', repeat('x', 9)),
    'select business.chat_carpeta_guardar(-1, ''Check no existe'', null)'
  ] loop
    begin
      execute v_sql;
      raise exception 'la carpeta no debe aceptarse: %', v_sql;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  v_c1 := business.chat_carpeta_guardar(null, ' Check Ventas ', '💰');
  v_c2 := business.chat_carpeta_guardar(null, 'Check Soporte', '  ');
  v_c3 := business.chat_carpeta_guardar(null, 'Check Tres', null);
  select count(*) into n from business.chat_carpeta
  where (id = v_c1 and nombre = 'Check Ventas' and icono = '💰' and orden = v_f0)
     or (id = v_c2 and icono is null and orden = v_f0 + 1)
     or (id = v_c3 and orden = v_f0 + 2);
  assert n = 3, 'las carpetas nuevas van al final, con nombre limpio e icono vacío = null';
  begin
    perform business.chat_carpeta_guardar(null, 'CHECK ventas', null);
    raise exception 'no debe aceptar una carpeta repetida';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'Ya existe una carpeta con ese nombre.', 'mensaje de carpeta repetida: ' || v_msg;
  end;
  for i in 1..(10 - v_f0 - 3) loop
    perform business.chat_carpeta_guardar(null, 'Check F' || i, null);
  end loop;
  begin
    perform business.chat_carpeta_guardar(null, 'Check 11', null);
    raise exception 'no debe aceptar la carpeta 11';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'Máximo 10 carpetas.', 'mensaje del tope de carpetas: ' || v_msg;
  end;

  select array_agg(id order by orden desc) into v_ids from business.chat_carpeta;
  foreach v_sql in array array[
    format('select business.chat_carpetas_ordenar(array[%s])', v_c1),
    format('select business.chat_carpetas_ordenar(%L::bigint[])', v_ids[1:9] || v_ids[1]),
    format('select business.chat_carpetas_ordenar(%L::bigint[])', v_ids[1:9] || array[-1]::bigint[]),
    'select business.chat_carpetas_ordenar(null)'
  ] loop
    begin
      execute v_sql;
      raise exception 'el orden no debe aceptarse: %', v_sql;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  perform business.chat_carpetas_ordenar(v_ids);
  select count(*) into n from business.chat_carpeta c join unnest(v_ids) with ordinality s(id, k) on s.id = c.id where c.orden = s.k - 1;
  assert n = 10, 'ordenar debe dejar las carpetas en el orden pedido';

  select array_agg(gen_random_uuid()) into v_uuids from generate_series(1, 101);
  begin
    perform business.chat_carpeta_chats(v_c1, v_uuids);
    raise exception 'no debe aceptar 101 chats en una carpeta';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'Máximo 100 chats por carpeta.', 'mensaje del tope por carpeta: ' || v_msg;
  end;
  begin
    perform business.chat_carpeta_chats(v_c1, array[gen_random_uuid()]);
    raise exception 'no debe aceptar un cliente que no existe';
  exception when invalid_parameter_value then null;
  end;
  perform business.chat_carpeta_chats(v_c1, array[v_cliente, v_otro]);
  perform business.chat_carpetas_de_cliente(v_cliente, array[v_c2, v_c3]);
  select array_agg(carpeta_id order by carpeta_id) into v_ids from business.chat_carpeta_cliente where cliente_id = v_cliente;
  assert v_ids = (select array_agg(x order by x) from unnest(array[v_c2, v_c3]) x), 'el chat debe quedar solo en las carpetas pedidas';
  select count(*) into n from business.chat_carpeta_cliente where carpeta_id = v_c1;
  assert n = 1, 'la carpeta 1 debe quedar solo con el otro cliente';
  perform business.chat_carpeta_eliminar(v_c2);
  select count(*) into n from (select orden, row_number() over (order by orden) - 1 k from business.chat_carpeta) s where s.orden <> s.k;
  assert n = 0, 'borrar una carpeta debe dejar el orden sin huecos';
  select count(*) into n from business.chat_carpeta_cliente where cliente_id = v_cliente;
  assert n = 1, 'borrar la carpeta saca sus chats (quedan en las demás)';

  -- 4) Chats fijados (≤5), archivar --------------------------------------------------------------------------------------
  perform business.chat_archivar(v_cliente, false);
  perform business.chat_fijar(v_cliente, false);
  perform business.chat_archivar(v_otro, false);
  perform business.chat_fijar(v_otro, false);
  select count(*) into n from business.chat_estado where fijado_en is not null;
  assert n <= 4, format('hay %s chats fijados: el check necesita fijar al menos 1', n);
  perform business.chat_fijar(v_cliente, true);
  for v_u in
    select c.id from security.client c
    where c.id not in (v_cliente, v_otro)
      and not exists (select 1 from business.chat_estado e where e.cliente_id = c.id and (e.fijado_en is not null or e.archivado_en is not null))
    order by c.created_at limit 4 - n
  loop
    perform business.chat_fijar(v_u, true);
  end loop;
  select count(*) into n from business.chat_estado where fijado_en is not null;
  assert n = 5, format('faltan clientes para llenar 5 fijados (hay %s)', n);
  begin
    perform business.chat_fijar(v_otro, true);
    raise exception 'no debe fijar un 6.º chat';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'Máximo 5 chats fijados.', 'mensaje del tope de fijados: ' || v_msg;
  end;
  perform business.chat_fijar(v_cliente, true); -- ya fijado: no hace nada
  perform business.chat_fijar(v_cliente, false);
  perform business.chat_fijar(v_otro, true);
  perform business.chat_archivar(v_otro, true);
  select count(*) into n from business.chat_estado where cliente_id = v_otro and fijado_en is null and archivado_en is not null;
  assert n = 1, 'archivar debe desfijar';
  begin
    perform business.chat_fijar(v_otro, true);
    raise exception 'no debe fijar un chat archivado';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_otro, 'asesor', 'check asesor no desarchiva', now() - interval '1 hour');
  select count(*) into n from business.chat_estado where cliente_id = v_otro and archivado_en is not null;
  assert n = 1, 'un mensaje del asesor no desarchiva';
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_otro, 'cliente', 'check vuelvo', now() - interval '1 hour');
  select count(*) into n from business.chat_estado where cliente_id = v_otro and archivado_en is null;
  assert n = 1, 'un mensaje nuevo del cliente desarchiva el chat';

  -- 5) No leídos, no leído a mano, eliminar chat y volver ---------------------------------------------------------------
  set local role authenticated;
  perform business.marcar_leidos_staff(v_cliente);
  v_b0 := business.chat_sin_leer_staff();
  select * into v_fila from business.chat_bandeja_staff() b where b.cliente_id = v_cliente;
  assert v_fila.ultimo_id = (select max(id) from business.mensaje_asesor where cliente_id = v_cliente), 'la bandeja debe mostrar el último mensaje';
  assert v_fila.sin_leer = 0 and not v_fila.no_leido_manual, 'chat recién abierto: sin no leídos';
  assert v_fila.etiquetas = (select array_agg(x order by x) from unnest(array[v_e1, v_e2]) x), 'la bandeja debe traer las etiquetas';
  assert v_fila.carpetas = array[v_c3], 'la bandeja debe traer las carpetas';
  reset role;
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at)
  values (v_cliente, 'cliente', 'check nl 1', now() - interval '1 hour'), (v_cliente, 'cliente', 'check nl 2', now() - interval '1 hour');
  set local role authenticated;
  assert business.chat_sin_leer_staff() = v_b0 + 2, 'la insignia debe sumar los 2 mensajes nuevos';
  select * into v_fila from business.chat_bandeja_staff() b where b.cliente_id = v_cliente;
  assert v_fila.sin_leer = 2, format('el chat debe tener 2 sin leer y tiene %s', v_fila.sin_leer);
  perform business.marcar_leidos_staff(v_cliente);
  assert business.chat_sin_leer_staff() = v_b0, 'abrir el chat debe bajar la insignia';
  perform business.chat_marcar_no_leido(v_cliente, true);
  assert business.chat_sin_leer_staff() = v_b0 + 1, 'un chat marcado no leído suma 1';
  select * into v_fila from business.chat_bandeja_staff() b where b.cliente_id = v_cliente;
  assert v_fila.no_leido_manual, 'la bandeja debe mostrar la marca de no leído';
  reset role;
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_cliente, 'cliente', 'check nl 3', now() - interval '1 hour');
  set local role authenticated;
  assert business.chat_sin_leer_staff() = v_b0 + 1, 'marca a mano + 1 real cuenta 1, no 2';
  perform business.marcar_leidos_staff(v_cliente);
  assert business.chat_sin_leer_staff() = v_b0, 'abrir el chat quita la marca a mano';
  select count(*) into n from business.chat_estado where cliente_id = v_cliente and not no_leido_manual;
  assert n = 1, 'marcar_leidos_staff debe apagar no_leido_manual';

  -- notas
  perform business.chat_notas_guardar(v_cliente, '  nota de check  ');
  begin
    perform business.chat_notas_guardar(v_cliente, repeat('n', 1001));
    raise exception 'no debe aceptar notas de más de 1000';
  exception when invalid_parameter_value then null;
  end;
  select count(*) into n from business.chat_estado where cliente_id = v_cliente and notas = 'nota de check';
  assert n = 1, 'las notas se guardan recortadas';

  reset role;
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_cliente, 'cliente', 'check antes de borrar', now() - interval '1 hour');
  set local role authenticated;
  perform business.chat_fijar(v_cliente, true);
  perform business.chat_marcar_no_leido(v_cliente, true);
  perform business.chat_eliminar(v_cliente);
  select count(*) into n from business.chat_bandeja_staff() b where b.cliente_id = v_cliente;
  assert n = 0, 'un chat eliminado no debe salir en la bandeja';
  assert business.chat_sin_leer_staff() = v_b0, 'un chat eliminado no suma a la insignia';
  select count(*) into n from business.chat_estado
  where cliente_id = v_cliente and fijado_en is null and archivado_en is null and not no_leido_manual and notas = 'nota de check'
    and eliminado_hasta = (select max(id) from business.mensaje_asesor where cliente_id = v_cliente);
  assert n = 1, 'eliminar desfija, quita la marca, guarda hasta dónde y conserva las notas';
  select count(*) into n from business.chat_carpeta_cliente where cliente_id = v_cliente;
  assert n = 0, 'eliminar saca el chat de las carpetas';
  select count(*) into n from business.chat_cliente_etiqueta where cliente_id = v_cliente;
  assert n = 2, 'eliminar conserva las etiquetas';
  -- el staff ya no puede responder, reaccionar ni fijar lo oculto
  foreach v_sql in array array[
    format('select business.enviar_mensaje_staff(%L, ''x'', ''panel'', null, null, %s)', v_cliente, v_m1),
    format('select business.mensaje_reaccionar(%s, ''👍'')', v_m1),
    format('select business.mensaje_fijar(%s, true)', v_m1)
  ] loop
    begin
      execute v_sql;
      raise exception 'el staff no debe actuar sobre un mensaje oculto: %', v_sql;
    exception when invalid_parameter_value then null;
    end;
  end loop;

  -- el cliente conserva todo y vuelve a escribir (respondiendo un mensaje viejo suyo)
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  select count(*) into n from business.mensaje_asesor where cliente_id = v_cliente and id = v_m1;
  assert n = 1, 'el cliente conserva su historial';
  v_nuevo := business.enviar_mensaje_asesor('check vuelvo', null, null, null, v_m1);
  select count(*) into n from business.mensaje_asesor where id = v_nuevo and responde_a = v_m1;
  assert n = 1, 'el cliente puede responder un mensaje suyo';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select * into v_fila from business.chat_bandeja_staff() b where b.cliente_id = v_cliente;
  assert v_fila.ultimo_id = v_nuevo and v_fila.ultimo_texto = 'check vuelvo', 'el chat vuelve con el mensaje nuevo';
  assert v_fila.sin_leer = 1, format('el chat vuelto debe tener 1 sin leer y tiene %s', v_fila.sin_leer);
  assert v_fila.carpetas = '{}' and v_fila.fijado_en is null, 'el chat vuelve sin carpetas ni fijado';
  assert business.chat_sin_leer_staff() = v_b0 + 1, 'la insignia cuenta solo el mensaje nuevo';

  -- 6) Reacciones ------------------------------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  assert business.mensaje_reaccionar(v_nuevo, '👍') = '👍', 'reaccionar devuelve la reacción';
  assert business.mensaje_reaccionar(v_nuevo, '❤') = '❤️', 'otra reacción reemplaza (❤ sin variante = ❤️)';
  reset role;
  select count(*) into n from business.mensaje_reaccion where mensaje_id = v_nuevo and user_id = v_cliente and emoji = '❤️' and autor = 'cliente';
  assert n = 1, 'una sola reacción por persona';
  set local role authenticated;
  assert business.mensaje_reaccionar(v_nuevo, '❤️') is null, 'la misma reacción la quita';
  assert business.mensaje_reaccionar(v_nuevo, '😂') = '😂', 'vuelve a reaccionar';
  assert business.mensaje_reaccionar(v_nuevo, null) is null, 'null la quita';
  reset role;
  select count(*) into n from business.mensaje_reaccion where mensaje_id = v_nuevo and user_id = v_cliente;
  assert n = 0, 'la reacción quitada no queda';
  set local role authenticated;
  begin
    perform business.mensaje_reaccionar(v_nuevo, '🔥');
    raise exception 'no debe aceptar una reacción fuera de la lista';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform business.mensaje_reaccionar(v_otro_msg, '👍');
    raise exception 'el cliente no debe reaccionar en el chat de otro';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  assert business.mensaje_reaccionar(v_nuevo, '🙏') = '🙏', 'el staff reacciona';
  perform business.mensaje_reaccionar(v_otro_msg, '👍');
  reset role;
  select count(*) into n from business.mensaje_reaccion where mensaje_id = v_nuevo and user_id = v_admin and autor = 'asesor';
  assert n = 1, 'la reacción del staff queda como asesor';
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from business.mensaje_reaccion where mensaje_id = v_nuevo;
  assert n = 1, 'el cliente ve las reacciones de su chat';
  select count(*) into n from business.mensaje_reaccion where mensaje_id = v_otro_msg;
  assert n = 0, 'el cliente no ve las reacciones del chat de otro';

  -- 7) Mensajes fijados (≤3, el 4.º desfija el más viejo) --------------------------------------------------------------
  reset role;
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_cliente, 'asesor', 'check p1', now() - interval '1 hour') returning id into v_p1;
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_cliente, 'cliente', 'check p2', now() - interval '1 hour') returning id into v_p2;
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_cliente, 'asesor', 'check p3', now() - interval '1 hour') returning id into v_p3;
  insert into business.mensaje_asesor (cliente_id, autor, texto, created_at) values (v_cliente, 'cliente', 'check p4', now() - interval '1 hour') returning id into v_p4;
  update business.mensaje_asesor set fijado_en = null where cliente_id = v_cliente and fijado_en is not null;
  set local role authenticated;
  perform business.mensaje_fijar(v_p1, true);
  perform business.mensaje_fijar(v_p2, true);
  perform business.mensaje_fijar(v_p3, true);
  perform business.mensaje_fijar(v_p4, true);
  select array_agg(id order by id) into v_ids from business.mensaje_asesor where cliente_id = v_cliente and fijado_en is not null;
  assert v_ids = array[v_p2, v_p3, v_p4], format('fijar el 4.º debe desfijar el más viejo; fijados: %s', v_ids);
  perform business.mensaje_fijar(v_p2, true); -- ya fijado: no rota
  perform business.mensaje_fijar(v_p3, false);
  select array_agg(id order by id) into v_ids from business.mensaje_asesor where cliente_id = v_cliente and fijado_en is not null;
  assert v_ids = array[v_p2, v_p4], format('desfijar debe quitar solo ese; fijados: %s', v_ids);
  begin
    perform business.mensaje_fijar(v_otro_msg, true);
    raise exception 'el cliente no debe fijar en el chat de otro';
  exception when insufficient_privilege then null;
  end;
  begin
    update business.mensaje_asesor set fijado_en = now() where id = v_p1;
    raise exception 'el cliente no debe fijar directo';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform business.mensaje_fijar(v_p1, true);
  select array_agg(id order by id) into v_ids from business.mensaje_asesor where cliente_id = v_cliente and fijado_en is not null;
  assert v_ids = array[v_p1, v_p2, v_p4], format('el staff también fija; fijados: %s', v_ids);

  -- 8) responde_a solo del mismo chat --------------------------------------------------------------------------------
  begin
    perform business.enviar_mensaje_staff(v_cliente, 'x', 'panel', null, null, v_otro_msg);
    raise exception 'el staff no debe responder un mensaje de otro chat';
  exception when invalid_parameter_value then null;
  end;
  v_nuevo := business.enviar_mensaje_staff(v_cliente, 'check respuesta', 'panel:check', null, null, v_p4);
  reset role;
  select count(*) into n from business.mensaje_asesor where id = v_nuevo and responde_a = v_p4 and autor = 'asesor';
  assert n = 1, 'el staff responde un mensaje del chat';
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform business.enviar_mensaje_asesor('x', null, null, null, v_otro_msg);
    raise exception 'el cliente no debe responder un mensaje de otro chat';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  set local role service_role;
  begin
    insert into business.mensaje_asesor (cliente_id, autor, texto, responde_a) values (v_cliente, 'asesor', 'x', v_otro_msg);
    raise exception 'el insert directo (webhook) no debe responder un mensaje de otro chat';
  exception when check_violation then null;
  end;
  begin
    update business.mensaje_asesor set responde_a = v_otro_msg where id = v_p1;
    raise exception 'tampoco con un update';
  exception when check_violation then null;
  end;
  insert into business.mensaje_asesor (cliente_id, autor, texto, responde_a, autor_via) values (v_cliente, 'asesor', 'check tg', v_p4, 'telegram:check')
  returning id into v_nuevo;
  insert into business.telegram_hilo (chat_id, message_id, cliente_id, mensaje_id) values (-1, -1, v_cliente, v_nuevo);
  reset role;

  -- 9) Nadie escribe directo las tablas nuevas; el cliente no lee las del staff -----------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  foreach v_sql in array array[
    'insert into business.chat_etiqueta (nombre, color) values (''x'', ''#3987e5'')',
    format('insert into business.chat_cliente_etiqueta (cliente_id, etiqueta_id) values (%L, %s)', v_otro, v_e1),
    'insert into business.chat_carpeta (nombre, orden) values (''x'', 99)',
    format('insert into business.chat_carpeta_cliente (carpeta_id, cliente_id) values (%s, %L)', v_c3, v_otro),
    format('insert into business.chat_estado (cliente_id) values (%L)', gen_random_uuid()),
    format('update business.chat_estado set notas = ''x'' where cliente_id = %L', v_cliente),
    format('insert into business.mensaje_reaccion (mensaje_id, user_id, autor, emoji) values (%s, %L, ''asesor'', ''👍'')', v_p1, v_admin),
    format('delete from business.mensaje_reaccion where mensaje_id = %s', v_nuevo)
  ] loop
    begin
      execute v_sql;
      raise exception 'el staff no debe escribir directo: %', v_sql;
    exception when insufficient_privilege then null;
    end;
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  select (select count(*) from business.chat_etiqueta) + (select count(*) from business.chat_cliente_etiqueta)
       + (select count(*) from business.chat_carpeta) + (select count(*) from business.chat_carpeta_cliente)
       + (select count(*) from business.chat_estado) into n;
  assert n = 0, format('el cliente no debe ver etiquetas, carpetas ni estado (ve %s filas)', n);
  begin
    insert into business.mensaje_reaccion (mensaje_id, user_id, autor, emoji) values (v_p2, v_cliente, 'cliente', '👍');
    raise exception 'el cliente no debe insertar reacciones directo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from business.telegram_hilo;
    raise exception 'el cliente no debe leer telegram_hilo';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 10) Borrar una etiqueta la quita de los chats ----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform business.chat_etiqueta_eliminar(v_e1);
  begin
    perform business.chat_etiqueta_eliminar(v_e1);
    raise exception 'borrar dos veces debe avisar';
  exception when invalid_parameter_value then null;
  end;
  select etiquetas into v_ids from business.chat_bandeja_staff() b where b.cliente_id = v_cliente;
  assert v_ids = array[v_e2], 'borrar la etiqueta la saca del chat';
  reset role;
end
$$;

select 'chat_bandeja_check: OK' as resultado;

rollback;
