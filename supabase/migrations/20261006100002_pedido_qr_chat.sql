-- Pago por QR desde el chat con el asesor (pedido del usuario 2026-10-04):
-- 1. "Pagar por QR" crea el pedido SIN comprobante (business.crear_pedido_qr): queda 'esperando_comprobante' con sus
--    perfiles reservados (fuera de la Tienda) y en el chat del cliente aparece al instante un mensaje automático del
--    asesor con el QR de la llave elegida, el monto y qué hacer. El asesor no tiene que hacer nada.
-- 2. El cliente sube el comprobante (imagen o PDF) al bucket privado 'comprobantes' como siempre (su carpeta '<uid>/')
--    y lo entrega con business.adjuntar_comprobante: el primero que llega se le asocia al pedido, que pasa a
--    'pendiente' (por verificar) y sigue el camino de siempre (panel, Telegram, aprobar/rechazar). El comprobante queda
--    también como mensaje del cliente en el chat (apunta al bucket 'comprobantes', no se copia el archivo).
-- 3. Un pedido 'esperando_comprobante' no vence: solo el staff lo resuelve. Puede rechazarlo (libera los perfiles);
--    aprobar sigue exigiendo 'pendiente' (sin comprobante no hay pago que verificar).
-- 4. El tope de un pedido abierto por cliente (20261005100004) cuenta los dos estados: 'pendiente' y
--    'esperando_comprobante'.
-- 5. Chat: adjuntos PDF ('documento') en las dos direcciones, y la columna adjunto_bucket dice de qué bucket es el
--    adjunto ('chat' como hasta ahora; 'llaves-qr' para el QR del mensaje automático, que es público y no se copia;
--    'comprobantes' para el comprobante entregado por el chat).
-- El camino viejo (subir el comprobante antes de crear el pedido, business.crear_pedido) sigue igual.

-- 1. Pedido sin comprobante mientras espera ------------------------------------------------------------------------

alter table business.pedido alter column comprobante_path drop not null;
-- Un pedido rechazado mientras esperaba el comprobante queda sin él; cualquier otro estado lo tiene.
alter table business.pedido add constraint pedido_comprobante_segun_estado
  check (comprobante_path is not null or estado in ('esperando_comprobante', 'rechazado'));

-- 2. Adjuntos del chat: bucket de origen y PDF ------------------------------------------------------------------------

alter table business.mensaje_asesor
  add column adjunto_bucket text not null default 'chat'
    check (adjunto_bucket in ('chat', 'llaves-qr', 'comprobantes')),
  -- Fuera de 'chat' solo se llega con un adjunto (el QR o el comprobante): el valor por defecto no aplica a esos.
  add constraint mensaje_asesor_adjunto_bucket_con_path check (adjunto_bucket = 'chat' or adjunto_path is not null);

alter table business.mensaje_asesor drop constraint mensaje_asesor_adjunto_tipo_check;
alter table business.mensaje_asesor add constraint mensaje_asesor_adjunto_tipo_check
  check (adjunto_tipo in ('imagen', 'audio', 'documento'));

-- Mismo tope de 10 MB; se suma el PDF.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac',
  'application/pdf'
]
where id = 'chat';

-- Mismo cuerpo que 20261004200001 salvo el tipo 'documento'. Lo usan enviar_mensaje_asesor y enviar_mensaje_staff
-- (adjuntos del bucket 'chat'); el webhook de Telegram inserta directo con service_role.
create or replace function business.validar_adjunto_chat(p_cliente_id uuid, p_path text, p_tipo text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_path is null and p_tipo is null then
    return;
  end if;
  if p_tipo is null or p_tipo not in ('imagen', 'audio', 'documento') or p_path is null
     or split_part(p_path, '/', 1) <> p_cliente_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'chat' and o.name = p_path) then
    raise exception 'El archivo adjunto no es válido. Vuelve a adjuntarlo.' using errcode = '22023';
  end if;
end
$$;

-- Mismo cuerpo que 20261005100005, pero "usado por un mensaje" mira solo los adjuntos del bucket 'chat' (un comprobante
-- con el mismo nombre en 'comprobantes' no cuenta como uso de un archivo del chat).
create or replace function business.chat_puede_subir()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with mios as (
    select o.name
    from storage.objects o
    where o.bucket_id = 'chat'
      and (storage.foldername(o.name))[1] = (select auth.uid())::text
      and o.created_at > now() - interval '1 day'
  )
  select (select count(*) from mios) < 50
     and (select count(*) from mios m
          where not exists (select 1 from business.mensaje_asesor ma
                            where ma.adjunto_bucket = 'chat' and ma.adjunto_path = m.name)) < 5;
$$;

-- 3. Reserva común a los dos caminos ---------------------------------------------------------------------------------

-- Lo que crear_pedido y crear_pedido_qr hacen igual (mismas guardas que 20261005100004): cliente activo, 1 a 5
-- perfiles, un solo pedido abierto (pendiente o esperando comprobante) serializado por cliente, llave visible, perfiles
-- disponibles al precio que vio el cliente. Crea el pedido ('pendiente' con comprobante, 'esperando_comprobante' sin
-- él), sus items y reserva los perfiles. Recibe el uid: solo la llaman esas dos funciones (nadie más tiene EXECUTE).
create function business.pedido_reservar(
  p_uid uuid,
  p_profile_ids bigint[],
  p_total_esperado numeric,
  p_llave_id bigint,
  p_comprobante text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[];
  v_abierto business.estado_pedido;
  v_llave text;
  v_llave_nombre text;
  v_total numeric(12,2);
  v_disponibles int;
  v_pedido bigint;
begin
  if p_uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if not exists (select 1 from security.client c where c.id = p_uid and c.exist) then
    raise exception 'Tu cuenta está dada de baja. Contacta a soporte.' using errcode = 'P0001';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_profile_ids) as x where x is not null;
  if coalesce(cardinality(v_ids), 0) = 0 or cardinality(v_ids) > 5 then
    raise exception 'Elige entre 1 y 5 perfiles.' using errcode = '22023';
  end if;

  -- Un pedido abierto a la vez por cliente: dos llamadas en paralelo (de cualquiera de los dos caminos) esperan acá y
  -- la segunda ya ve el primero.
  perform pg_advisory_xact_lock(hashtext('crear_pedido:' || p_uid::text));
  select pe.estado into v_abierto from business.pedido pe
  where pe.cliente_id = p_uid and pe.estado in ('pendiente', 'esperando_comprobante')
  order by pe.id limit 1;
  if v_abierto = 'pendiente' then
    raise exception 'Ya tienes un pago por verificar. Espera a que lo revisemos.' using errcode = 'P0001';
  end if;
  if v_abierto = 'esperando_comprobante' then
    raise exception 'Ya tienes un pedido esperando el comprobante. Envíalo por el chat con el asesor.' using errcode = 'P0001';
  end if;

  select l.llave, l.nombre into v_llave, v_llave_nombre from business.llave_breb l
  where l.activa and (p_llave_id is null or l.id = p_llave_id)
  order by l.predeterminada desc, l.id limit 1;
  if v_llave is null then
    if p_llave_id is not null and exists (select 1 from business.llave_breb l where l.activa) then
      raise exception 'La llave que elegiste ya no está disponible. Elige otra.' using errcode = 'P0001';
    end if;
    raise exception 'Los pagos por Bre-B no están disponibles en este momento.' using errcode = 'P0001';
  end if;

  perform 1 from business.profile p where p.id = any (v_ids) for update;

  select count(*), coalesce(sum(c.precio_venta), 0) into v_disponibles, v_total
  from business.catalogo_disponible c where c.profile_id = any (v_ids);
  if v_disponibles <> cardinality(v_ids) then
    raise exception 'Algunos perfiles ya no están disponibles.' using errcode = 'P0001';
  end if;
  if p_total_esperado is null or v_total <> p_total_esperado then
    raise exception 'El precio cambió mientras pagabas.' using errcode = 'P0001';
  end if;

  insert into business.pedido (cliente_id, estado, total, llave_breb, llave_nombre, comprobante_path)
  values (p_uid, case when p_comprobante is null then 'esperando_comprobante' else 'pendiente' end::business.estado_pedido,
          v_total, v_llave, v_llave_nombre, p_comprobante)
  returning id into v_pedido;

  insert into business.pedido_item (pedido_id, profile_id, platform_nombre, perfil_nombre, access_type, precio)
  select v_pedido, c.profile_id, c.platform_nombre, c.perfil_nombre, c.access_type::text, c.precio_venta
  from business.catalogo_disponible c where c.profile_id = any (v_ids);

  perform set_config('playr.pedido', 'on', true);
  update business.profile p set estado = 'reservado' where p.id = any (v_ids);
  perform set_config('playr.pedido', '', true);

  return v_pedido;
end
$$;

revoke all on function business.pedido_reservar(uuid, bigint[], numeric, bigint, text) from public, anon, authenticated, service_role;

-- Comprobante en 'comprobantes' del cliente que llama, que existe y que ningún pedido usa. Error si no sirve.
create function business.validar_comprobante(p_uid uuid, p_comprobante text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_comprobante is null or split_part(p_comprobante, '/', 1) <> p_uid::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'comprobantes' and o.name = p_comprobante) then
    raise exception 'No encontramos el comprobante. Súbelo de nuevo.' using errcode = '22023';
  end if;
  if exists (select 1 from business.pedido pe where pe.comprobante_path = p_comprobante) then
    raise exception 'Este comprobante ya está en otro pedido.' using errcode = '22023';
  end if;
end
$$;

revoke all on function business.validar_comprobante(uuid, text) from public, anon, authenticated, service_role;

-- 4. Camino de siempre: comprobante primero ---------------------------------------------------------------------------

-- Misma firma, guardas y mensajes que 20261005100004; ahora el pedido abierto que bloquea puede ser también uno que
-- espera su comprobante.
create or replace function business.crear_pedido(p_profile_ids bigint[], p_comprobante text, p_total_esperado numeric, p_llave_id bigint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  perform business.validar_comprobante(v_uid, p_comprobante);
  return business.pedido_reservar(v_uid, p_profile_ids, p_total_esperado, p_llave_id, p_comprobante);
end
$$;

-- 5. Pago por QR: pedido primero, comprobante por el chat ------------------------------------------------------------

-- Monto en pesos con separador de miles colombiano: 25000 → '25.000' (con centavos, '25.000,50'). En to_char la coma
-- y el punto son literales (no dependen del locale, a diferencia de G y D).
create function business.formato_cop(p_monto numeric)
returns text
language sql
stable
set search_path = ''
as $$
  select regexp_replace(translate(to_char(p_monto, 'FM999,999,999,990.00'), ',.', '.,'), ',00$', '')
$$;

revoke all on function business.formato_cop(numeric) from public, anon, authenticated;

-- Crea el pedido del cliente que llama sin comprobante ('esperando_comprobante', perfiles reservados) y deja en su chat
-- el mensaje automático del asesor con el QR de la llave (bucket público 'llaves-qr', no se copia ni se sube nada) y el
-- monto. Sin QR cargado en la llave, el mensaje va igual con la llave escrita. El mensaje no cuenta para los topes del
-- cliente (es del asesor) y queda sin leer para que el cliente lo vea como nuevo. Devuelve el id del pedido.
create function business.crear_pedido_qr(p_profile_ids bigint[], p_total_esperado numeric, p_llave_id bigint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pedido bigint;
  v_total numeric(12,2);
  v_llave text;
  v_llave_nombre text;
  v_qr text;
  v_monto text;
begin
  if v_uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;

  v_pedido := business.pedido_reservar(v_uid, p_profile_ids, p_total_esperado, p_llave_id, null);

  select pe.total, pe.llave_breb, pe.llave_nombre into v_total, v_llave, v_llave_nombre
  from business.pedido pe where pe.id = v_pedido;
  select l.qr_path into v_qr from business.llave_breb l where l.llave = v_llave;
  v_monto := business.formato_cop(v_total);

  insert into business.mensaje_asesor (cliente_id, pedido_id, autor, autor_via, texto, adjunto_bucket, adjunto_path, adjunto_tipo)
  values (
    v_uid, v_pedido, 'asesor', 'automatico',
    format(
      'Pedido #%s: transfiere $%s a la llave Bre-B %s (%s). %s, escribe el monto exacto ($%s) y envíanos por este chat '
      || 'el comprobante (imagen o PDF). Tus perfiles quedan apartados hasta que verifiquemos el pago.',
      v_pedido, v_monto, v_llave_nombre, v_llave,
      case when v_qr is null then 'Desde la app de tu banco o Nequi, paga a esa llave'
           else 'Escanea o guarda este QR desde la app de tu banco o Nequi' end,
      v_monto
    ),
    case when v_qr is null then 'chat' else 'llaves-qr' end,
    v_qr,
    case when v_qr is null then null else 'imagen' end
  );

  return v_pedido;
end
$$;

revoke all on function business.crear_pedido_qr(bigint[], numeric, bigint) from public, anon;
grant execute on function business.crear_pedido_qr(bigint[], numeric, bigint) to authenticated;

-- El cliente entrega el comprobante de su pedido que espera uno: el archivo ya subido a su carpeta de 'comprobantes'
-- (cuenta como "con pedido" para el tope de subidas de comprobantes_sin_pedido apenas queda asociado). Solo el primero
-- se asocia: el update exige 'esperando_comprobante', así dos envíos a la vez no pisan el comprobante. El pedido pasa a
-- 'pendiente' y el comprobante queda como mensaje del cliente en el chat (sin leer para el staff). Devuelve el id de
-- ese mensaje.
create function business.adjuntar_comprobante(p_pedido_id bigint, p_comprobante text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tipo text;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  perform business.validar_comprobante(v_uid, p_comprobante);

  update business.pedido pe set estado = 'pendiente', comprobante_path = p_comprobante
  where pe.id = p_pedido_id and pe.cliente_id = v_uid and pe.estado = 'esperando_comprobante'
  returning pe.id into v_id;
  if v_id is null then
    if exists (select 1 from business.pedido pe where pe.id = p_pedido_id and pe.cliente_id = v_uid) then
      raise exception 'Este pedido ya no está esperando un comprobante.' using errcode = 'P0001';
    end if;
    raise exception 'Pedido no encontrado.' using errcode = '22023';
  end if;

  -- PDF por el tipo que guardó Storage (o la extensión si no lo tiene); lo demás que acepta el bucket son imágenes.
  select case when lower(coalesce(o.metadata ->> 'mimetype', '')) = 'application/pdf' or lower(o.name) like '%.pdf'
              then 'documento' else 'imagen' end
  into v_tipo
  from storage.objects o where o.bucket_id = 'comprobantes' and o.name = p_comprobante;

  insert into business.mensaje_asesor (cliente_id, pedido_id, autor, texto, adjunto_bucket, adjunto_path, adjunto_tipo)
  values (v_uid, p_pedido_id, 'cliente', format('Comprobante de pago del pedido #%s.', p_pedido_id),
          'comprobantes', p_comprobante, v_tipo)
  returning id into v_id;
  return v_id;
end
$$;

revoke all on function business.adjuntar_comprobante(bigint, text) from public, anon;
grant execute on function business.adjuntar_comprobante(bigint, text) to authenticated;

-- 6. Revisión del staff ------------------------------------------------------------------------------------------------

-- Mismo cuerpo que 20261003190001 salvo el mensaje cuando el pedido todavía espera el comprobante.
create or replace function business.aprobar_pedido(p_pedido_id bigint, p_via text default 'panel')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado business.estado_pedido;
  v_items int;
  v_reservados int;
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select pe.estado into v_estado from business.pedido pe where pe.id = p_pedido_id for update;
  if v_estado is null then
    raise exception 'No existe el pedido.' using errcode = 'P0002';
  end if;
  if v_estado = 'esperando_comprobante' then
    raise exception 'El pedido todavía no tiene comprobante: no se puede aprobar.' using errcode = 'P0001';
  end if;
  if v_estado <> 'pendiente' then
    raise exception 'El pedido ya fue revisado.' using errcode = 'P0001';
  end if;

  select count(*), count(*) filter (where p.estado = 'reservado') into v_items, v_reservados
  from business.pedido_item i join business.profile p on p.id = i.profile_id
  where i.pedido_id = p_pedido_id;
  if v_items = 0 or v_reservados <> v_items then
    raise exception 'Algún perfil del pedido ya no está reservado: no se puede aprobar. Rechaza el pedido y revisa sus perfiles.' using errcode = 'P0001';
  end if;

  update business.pedido pe
  set estado = 'aprobado', revisado_at = now(), revisado_by = auth.uid(), revisado_via = left(coalesce(p_via, 'panel'), 80)
  where pe.id = p_pedido_id;

  perform set_config('playr.pedido', 'on', true);
  update business.profile p set estado = 'vendido'
  where p.estado = 'reservado' and p.id in (select i.profile_id from business.pedido_item i where i.pedido_id = p_pedido_id);
  perform set_config('playr.pedido', '', true);
end
$$;

-- Mismo cuerpo que 20261003190001, pero también rechaza un pedido que espera el comprobante: es la única forma de
-- liberar sus perfiles (no vence solo).
create or replace function business.rechazar_pedido(p_pedido_id bigint, p_motivo text, p_via text default 'panel')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado business.estado_pedido;
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select pe.estado into v_estado from business.pedido pe where pe.id = p_pedido_id for update;
  if v_estado is null then
    raise exception 'No existe el pedido.' using errcode = 'P0002';
  end if;
  if v_estado not in ('pendiente', 'esperando_comprobante') then
    raise exception 'El pedido ya fue revisado.' using errcode = 'P0001';
  end if;

  update business.pedido pe
  set estado = 'rechazado', motivo_rechazo = left(nullif(trim(p_motivo), ''), 300),
      revisado_at = now(), revisado_by = auth.uid(), revisado_via = left(coalesce(p_via, 'panel'), 80)
  where pe.id = p_pedido_id;

  perform set_config('playr.pedido', 'on', true);
  update business.profile p set estado = 'disponible'
  where p.estado = 'reservado' and p.id in (select i.profile_id from business.pedido_item i where i.pedido_id = p_pedido_id);
  perform set_config('playr.pedido', '', true);
end
$$;
