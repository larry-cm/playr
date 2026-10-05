-- Bandeja de mensajes del staff al nivel de WhatsApp Business / Telegram (/administrar/mensajes):
-- 1. Etiquetas por cliente (≤20, color de una paleta fija, varias por chat) para filtrar la lista.
-- 2. Carpetas (≤10, nombre único, icono opcional, ordenables, ≤100 chats cada una; un chat puede estar en varias).
-- 3. Estado por chat (business.chat_estado): fijado (≤5), archivado, "eliminado hasta" un mensaje, no leído a mano y notas
--    internas. Eliminar un chat es solo para el staff (como "eliminar chat" de WhatsApp): oculta el chat y sus mensajes
--    hasta ese momento; el cliente conserva todo su historial; si el cliente vuelve a escribir, el chat reaparece solo con
--    lo nuevo. Un mensaje nuevo del cliente desarchiva el chat (como Telegram).
-- 4. Mensajes: responder (responde_a, siempre del mismo chat), reaccionar (una reacción por persona y mensaje, de un set
--    fijo de 6 emojis) y fijar (≤3 por chat; fijar un 4.º desfija el más viejo, como WhatsApp). Lo usan el staff y el
--    cliente en su propio chat.
-- 5. telegram_hilo.mensaje_id: qué mensaje de Playr copia cada mensaje de Telegram, para mapear respuestas.
-- 6. Lecturas para el panel: chat_bandeja_staff() (un chat por cliente con su último mensaje visible) y
--    chat_sin_leer_staff() (insignia del menú).
-- Etiquetas, carpetas, fijados y archivados son compartidos por todo el staff (una sola bandeja del negocio), igual que
-- `leido`. Nadie escribe estas tablas directo: solo las funciones (security definer). El staff las lee; el cliente solo
-- ve las reacciones de los mensajes de su chat.

-- 1. Tablas ----------------------------------------------------------------------------------------------------------

create table business.chat_etiqueta (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(nombre) between 1 and 30 and nombre = btrim(nombre)),
  color text not null check (color in (
    '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e5484d', '#0ea5e9', '#a855f7'
  )),
  created_at timestamptz not null default now()
);
create unique index chat_etiqueta_nombre on business.chat_etiqueta (lower(nombre));

create table business.chat_cliente_etiqueta (
  cliente_id uuid not null references auth.users(id) on delete cascade,
  etiqueta_id bigint not null references business.chat_etiqueta(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cliente_id, etiqueta_id)
);
create index chat_cliente_etiqueta_etiqueta on business.chat_cliente_etiqueta (etiqueta_id);

create table business.chat_carpeta (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(nombre) between 1 and 24 and nombre = btrim(nombre)),
  icono text check (icono is null or char_length(icono) between 1 and 8),
  -- 0..n-1 sin huecos (lo mantienen las funciones).
  orden int not null check (orden >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_carpeta_orden_unico unique (orden) deferrable initially deferred
);
create unique index chat_carpeta_nombre on business.chat_carpeta (lower(nombre));

create table business.chat_carpeta_cliente (
  carpeta_id bigint not null references business.chat_carpeta(id) on delete cascade,
  cliente_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (carpeta_id, cliente_id)
);
create index chat_carpeta_cliente_cliente on business.chat_carpeta_cliente (cliente_id);

create table business.chat_estado (
  cliente_id uuid primary key references auth.users(id) on delete cascade,
  fijado_en timestamptz,
  archivado_en timestamptz,
  -- El staff ve solo los mensajes con id > eliminado_hasta (null = todos).
  eliminado_hasta bigint,
  no_leido_manual boolean not null default false,
  notas text check (notas is null or char_length(notas) between 1 and 1000),
  updated_at timestamptz not null default now(),
  constraint chat_estado_fijado_no_archivado check (fijado_en is null or archivado_en is null)
);

alter table business.mensaje_asesor
  add column responde_a bigint references business.mensaje_asesor(id) on delete set null,
  add column fijado_en timestamptz;
create index mensaje_asesor_fijado on business.mensaje_asesor (cliente_id) where fijado_en is not null;
create index mensaje_asesor_responde_a on business.mensaje_asesor (responde_a) where responde_a is not null;

create table business.mensaje_reaccion (
  mensaje_id bigint not null references business.mensaje_asesor(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  autor text not null check (autor in ('cliente', 'asesor')),
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at timestamptz not null default now(),
  primary key (mensaje_id, user_id)
);

alter table business.telegram_hilo add column mensaje_id bigint references business.mensaje_asesor(id) on delete set null;
create index telegram_hilo_mensaje on business.telegram_hilo (mensaje_id) where mensaje_id is not null;

-- Permisos: el staff lee; nadie escribe directo (solo las funciones de abajo).
alter table business.chat_etiqueta enable row level security;
alter table business.chat_cliente_etiqueta enable row level security;
alter table business.chat_carpeta enable row level security;
alter table business.chat_carpeta_cliente enable row level security;
alter table business.chat_estado enable row level security;
alter table business.mensaje_reaccion enable row level security;

revoke all on business.chat_etiqueta, business.chat_cliente_etiqueta, business.chat_carpeta,
  business.chat_carpeta_cliente, business.chat_estado, business.mensaje_reaccion from public, anon, authenticated;
grant select on business.chat_etiqueta, business.chat_cliente_etiqueta, business.chat_carpeta,
  business.chat_carpeta_cliente, business.chat_estado, business.mensaje_reaccion to authenticated, service_role;

create policy "staff lee" on business.chat_etiqueta for select to authenticated using (business.es_staff());
create policy "staff lee" on business.chat_cliente_etiqueta for select to authenticated using (business.es_staff());
create policy "staff lee" on business.chat_carpeta for select to authenticated using (business.es_staff());
create policy "staff lee" on business.chat_carpeta_cliente for select to authenticated using (business.es_staff());
create policy "staff lee" on business.chat_estado for select to authenticated using (business.es_staff());
create policy "staff o mensaje de su chat" on business.mensaje_reaccion for select to authenticated
  using (
    business.es_staff()
    or exists (select 1 from business.mensaje_asesor m where m.id = mensaje_id and m.cliente_id = (select auth.uid()))
  );

-- 2. Triggers --------------------------------------------------------------------------------------------------------

-- responde_a siempre apunta a un mensaje del mismo chat (cubre también el insert directo del webhook de Telegram).
create function business.mensaje_responde_mismo_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from business.mensaje_asesor m where m.id = new.responde_a and m.cliente_id = new.cliente_id and m.id <> new.id
  ) then
    raise exception 'La respuesta debe ser a un mensaje del mismo chat.' using errcode = '23514';
  end if;
  return null;
end
$$;

create constraint trigger mensaje_asesor_responde_mismo_chat
  after insert or update of responde_a, cliente_id on business.mensaje_asesor
  for each row when (new.responde_a is not null)
  execute function business.mensaje_responde_mismo_chat();

-- Un mensaje nuevo del cliente desarchiva su chat (un chat eliminado reaparece solo: el id nuevo > eliminado_hasta).
create function business.chat_desarchivar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update business.chat_estado e set archivado_en = null, updated_at = now()
  where e.cliente_id = new.cliente_id and e.archivado_en is not null;
  return null;
end
$$;

create trigger mensaje_asesor_desarchiva
  after insert on business.mensaje_asesor
  for each row when (new.autor = 'cliente')
  execute function business.chat_desarchivar();

-- 3. Ayudas internas (sin EXECUTE para la API) -----------------------------------------------------------------------

-- Nombre de etiqueta/carpeta: espacios (y saltos de línea) seguidos → uno, sin espacios en los bordes.
create function business.chat_nombre_limpio(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))
$$;

-- El cliente existe (security.client) y su fila de chat_estado también (la crea si falta).
create function business.chat_estado_de(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_cliente_id is null or not exists (select 1 from security.client c where c.id = p_cliente_id) then
    raise exception 'Cliente no encontrado.' using errcode = '22023';
  end if;
  insert into business.chat_estado (cliente_id) values (p_cliente_id) on conflict (cliente_id) do nothing;
end
$$;

-- Lista de ids sin nulos ni repetidos (null = lista vacía).
create function business.chat_lista_valida(p_ids anyarray)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_ids is null
      or (array_position(p_ids, null) is null
          and cardinality(p_ids) = (select count(distinct x) from unnest(p_ids) x))
$$;

revoke all on function business.mensaje_responde_mismo_chat() from public, anon, authenticated;
revoke all on function business.chat_desarchivar() from public, anon, authenticated;
revoke all on function business.chat_nombre_limpio(text) from public, anon, authenticated;
revoke all on function business.chat_estado_de(uuid) from public, anon, authenticated;
revoke all on function business.chat_lista_valida(anyarray) from public, anon, authenticated;

-- 4. Etiquetas -------------------------------------------------------------------------------------------------------

-- p_id null = crear. Devuelve el id.
create function business.chat_etiqueta_guardar(p_id bigint, p_nombre text, p_color text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := business.chat_nombre_limpio(p_nombre);
  v_color text := lower(btrim(coalesce(p_color, '')));
  v_id bigint;
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if char_length(v_nombre) = 0 then
    raise exception 'Escribe el nombre de la etiqueta.' using errcode = '22023';
  end if;
  if char_length(v_nombre) > 30 then
    raise exception 'El nombre de la etiqueta es muy largo (máximo 30 caracteres).' using errcode = '22023';
  end if;
  if v_color not in ('#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e5484d', '#0ea5e9', '#a855f7') then
    raise exception 'Elige un color de la lista.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('business.chat_etiqueta'));
  if exists (select 1 from business.chat_etiqueta e where lower(e.nombre) = lower(v_nombre) and e.id is distinct from p_id) then
    raise exception 'Ya existe una etiqueta con ese nombre.' using errcode = '22023';
  end if;

  if p_id is null then
    if (select count(*) from business.chat_etiqueta) >= 20 then
      raise exception 'Máximo 20 etiquetas.' using errcode = '22023';
    end if;
    insert into business.chat_etiqueta (nombre, color) values (v_nombre, v_color) returning id into v_id;
  else
    update business.chat_etiqueta e set nombre = v_nombre, color = v_color where e.id = p_id returning e.id into v_id;
    if v_id is null then
      raise exception 'Etiqueta no encontrada.' using errcode = '22023';
    end if;
  end if;
  return v_id;
end
$$;

-- Borra la etiqueta (y la quita de todos los chats).
create function business.chat_etiqueta_eliminar(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  delete from business.chat_etiqueta e where e.id = p_id;
  if not found then
    raise exception 'Etiqueta no encontrada.' using errcode = '22023';
  end if;
end
$$;

-- Deja exactamente esas etiquetas en el chat del cliente (null o vacío = ninguna).
create function business.chat_etiquetas_asignar(p_cliente_id uuid, p_etiquetas bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[] := coalesce(p_etiquetas, '{}');
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  perform business.chat_estado_de(p_cliente_id);
  if not business.chat_lista_valida(v_ids) then
    raise exception 'La lista de etiquetas no es válida.' using errcode = '22023';
  end if;
  if (select count(*) from business.chat_etiqueta e where e.id = any (v_ids)) <> cardinality(v_ids) then
    raise exception 'Etiqueta no encontrada.' using errcode = '22023';
  end if;

  delete from business.chat_cliente_etiqueta ce where ce.cliente_id = p_cliente_id and ce.etiqueta_id <> all (v_ids);
  insert into business.chat_cliente_etiqueta (cliente_id, etiqueta_id)
  select p_cliente_id, x from unnest(v_ids) x
  on conflict do nothing;
end
$$;

-- 5. Carpetas --------------------------------------------------------------------------------------------------------

-- p_id null = crear (va al final). Devuelve el id.
create function business.chat_carpeta_guardar(p_id bigint, p_nombre text, p_icono text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := business.chat_nombre_limpio(p_nombre);
  v_icono text := nullif(btrim(coalesce(p_icono, '')), '');
  v_id bigint;
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if char_length(v_nombre) = 0 then
    raise exception 'Escribe el nombre de la carpeta.' using errcode = '22023';
  end if;
  if char_length(v_nombre) > 24 then
    raise exception 'El nombre de la carpeta es muy largo (máximo 24 caracteres).' using errcode = '22023';
  end if;
  if char_length(v_icono) > 8 then
    raise exception 'El icono no es válido.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('business.chat_carpeta'));
  if exists (select 1 from business.chat_carpeta c where lower(c.nombre) = lower(v_nombre) and c.id is distinct from p_id) then
    raise exception 'Ya existe una carpeta con ese nombre.' using errcode = '22023';
  end if;

  if p_id is null then
    if (select count(*) from business.chat_carpeta) >= 10 then
      raise exception 'Máximo 10 carpetas.' using errcode = '22023';
    end if;
    insert into business.chat_carpeta (nombre, icono, orden)
    values (v_nombre, v_icono, (select coalesce(max(c.orden) + 1, 0) from business.chat_carpeta c))
    returning id into v_id;
  else
    update business.chat_carpeta c set nombre = v_nombre, icono = v_icono, updated_at = now()
    where c.id = p_id returning c.id into v_id;
    if v_id is null then
      raise exception 'Carpeta no encontrada.' using errcode = '22023';
    end if;
  end if;
  return v_id;
end
$$;

-- Borra la carpeta (los chats quedan; solo salen de ella) y deja el orden sin huecos.
create function business.chat_carpeta_eliminar(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('business.chat_carpeta'));
  delete from business.chat_carpeta c where c.id = p_id;
  if not found then
    raise exception 'Carpeta no encontrada.' using errcode = '22023';
  end if;
  update business.chat_carpeta c set orden = s.n
  from (select c2.id, (row_number() over (order by c2.orden, c2.id) - 1)::int n from business.chat_carpeta c2) s
  where s.id = c.id and c.orden <> s.n;
end
$$;

-- Nuevo orden: p_ids tiene que ser exactamente el conjunto de carpetas, cada una una vez.
create function business.chat_carpetas_ordenar(p_ids bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('business.chat_carpeta'));
  if p_ids is null or not business.chat_lista_valida(p_ids)
     or cardinality(p_ids) <> (select count(*) from business.chat_carpeta)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from business.chat_carpeta c where c.id = x)) then
    raise exception 'La lista de carpetas no coincide. Recarga la página.' using errcode = '22023';
  end if;
  update business.chat_carpeta c set orden = (s.n - 1)::int, updated_at = now()
  from unnest(p_ids) with ordinality s(id, n)
  where s.id = c.id;
end
$$;

-- Deja exactamente esos chats en la carpeta (≤100).
create function business.chat_carpeta_chats(p_carpeta_id bigint, p_clientes uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := coalesce(p_clientes, '{}');
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if not business.chat_lista_valida(v_ids) then
    raise exception 'La lista de chats no es válida.' using errcode = '22023';
  end if;
  if cardinality(v_ids) > 100 then
    raise exception 'Máximo 100 chats por carpeta.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('business.chat_carpeta'));
  if not exists (select 1 from business.chat_carpeta c where c.id = p_carpeta_id) then
    raise exception 'Carpeta no encontrada.' using errcode = '22023';
  end if;
  if (select count(*) from security.client c where c.id = any (v_ids)) <> cardinality(v_ids) then
    raise exception 'Cliente no encontrado.' using errcode = '22023';
  end if;

  delete from business.chat_carpeta_cliente cc where cc.carpeta_id = p_carpeta_id and cc.cliente_id <> all (v_ids);
  insert into business.chat_carpeta_cliente (carpeta_id, cliente_id)
  select p_carpeta_id, x from unnest(v_ids) x
  on conflict do nothing;
end
$$;

-- Deja el chat del cliente exactamente en esas carpetas (null o vacío = ninguna), sin pasar 100 chats por carpeta.
create function business.chat_carpetas_de_cliente(p_cliente_id uuid, p_carpetas bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[] := coalesce(p_carpetas, '{}');
  v_llena text;
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  perform business.chat_estado_de(p_cliente_id);
  if not business.chat_lista_valida(v_ids) then
    raise exception 'La lista de carpetas no es válida.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('business.chat_carpeta'));
  if (select count(*) from business.chat_carpeta c where c.id = any (v_ids)) <> cardinality(v_ids) then
    raise exception 'Carpeta no encontrada.' using errcode = '22023';
  end if;
  select c.nombre into v_llena
  from business.chat_carpeta c
  where c.id = any (v_ids)
    and not exists (select 1 from business.chat_carpeta_cliente cc where cc.carpeta_id = c.id and cc.cliente_id = p_cliente_id)
    and (select count(*) from business.chat_carpeta_cliente cc where cc.carpeta_id = c.id) >= 100
  limit 1;
  if v_llena is not null then
    raise exception 'La carpeta "%" ya tiene 100 chats.', v_llena using errcode = '22023';
  end if;

  delete from business.chat_carpeta_cliente cc where cc.cliente_id = p_cliente_id and cc.carpeta_id <> all (v_ids);
  insert into business.chat_carpeta_cliente (carpeta_id, cliente_id)
  select x, p_cliente_id from unnest(v_ids) x
  on conflict do nothing;
end
$$;

-- 6. Estado del chat -------------------------------------------------------------------------------------------------

-- Fija (≤5) o desfija. Un chat archivado no se puede fijar.
create function business.chat_fijar(p_cliente_id uuid, p_fijar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  perform business.chat_estado_de(p_cliente_id);
  if not coalesce(p_fijar, false) then
    update business.chat_estado e set fijado_en = null, updated_at = now() where e.cliente_id = p_cliente_id and e.fijado_en is not null;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('business.chat_estado.fijado'));
  if exists (select 1 from business.chat_estado e where e.cliente_id = p_cliente_id and e.fijado_en is not null) then
    return;
  end if;
  if exists (select 1 from business.chat_estado e where e.cliente_id = p_cliente_id and e.archivado_en is not null) then
    raise exception 'Desarchiva el chat antes de fijarlo.' using errcode = '22023';
  end if;
  if (select count(*) from business.chat_estado e where e.fijado_en is not null) >= 5 then
    raise exception 'Máximo 5 chats fijados.' using errcode = '22023';
  end if;
  update business.chat_estado e set fijado_en = clock_timestamp(), updated_at = now() where e.cliente_id = p_cliente_id;
end
$$;

-- Archiva (y desfija) o desarchiva.
create function business.chat_archivar(p_cliente_id uuid, p_archivar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  perform business.chat_estado_de(p_cliente_id);
  if coalesce(p_archivar, false) then
    update business.chat_estado e set archivado_en = coalesce(e.archivado_en, now()), fijado_en = null, updated_at = now()
    where e.cliente_id = p_cliente_id;
  else
    update business.chat_estado e set archivado_en = null, updated_at = now() where e.cliente_id = p_cliente_id;
  end if;
end
$$;

-- "Eliminar chat" (solo para el staff): oculta todo hasta el último mensaje de hoy, lo da por leído, lo desfija,
-- desarchiva, le quita la marca de no leído y lo saca de las carpetas. Etiquetas y notas quedan (son del cliente).
create function business.chat_eliminar(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hasta bigint;
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  perform business.chat_estado_de(p_cliente_id);
  select max(m.id) into v_hasta from business.mensaje_asesor m where m.cliente_id = p_cliente_id;
  if v_hasta is null then
    raise exception 'El chat no tiene mensajes.' using errcode = '22023';
  end if;

  update business.chat_estado e
  set eliminado_hasta = v_hasta, fijado_en = null, archivado_en = null, no_leido_manual = false, updated_at = now()
  where e.cliente_id = p_cliente_id;
  update business.mensaje_asesor m set leido = true
  where m.cliente_id = p_cliente_id and m.autor = 'cliente' and not m.leido and m.id <= v_hasta;
  delete from business.chat_carpeta_cliente cc where cc.cliente_id = p_cliente_id;
end
$$;

-- Marca (o quita) "no leído" a mano. Abrir el chat (marcar_leidos_staff) la quita.
create function business.chat_marcar_no_leido(p_cliente_id uuid, p_no_leido boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  perform business.chat_estado_de(p_cliente_id);
  update business.chat_estado e set no_leido_manual = coalesce(p_no_leido, false), updated_at = now()
  where e.cliente_id = p_cliente_id;
end
$$;

-- Notas internas del chat (≤1000; vacías = sin notas). El cliente no las ve.
create function business.chat_notas_guardar(p_cliente_id uuid, p_notas text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notas text := nullif(btrim(coalesce(p_notas, '')), '');
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if char_length(v_notas) > 1000 then
    raise exception 'Las notas son muy largas (máximo 1000 caracteres).' using errcode = '22023';
  end if;
  perform business.chat_estado_de(p_cliente_id);
  update business.chat_estado e set notas = v_notas, updated_at = now() where e.cliente_id = p_cliente_id;
end
$$;

-- 7. Reacciones y mensajes fijados (staff o el cliente dueño del chat) -----------------------------------------------

-- Quién actúa sobre un mensaje: 'asesor' (staff; el mensaje tiene que estar visible para el staff) o 'cliente' (dueño del
-- chat). Devuelve el cliente_id del chat. Otro cliente o mensaje ajeno → sin permiso (no revela si existe).
create function business.mensaje_actor(p_mensaje_id bigint, out o_cliente_id uuid, out o_autor text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  select m.cliente_id into o_cliente_id from business.mensaje_asesor m where m.id = p_mensaje_id;
  if business.es_staff() then
    if o_cliente_id is null or exists (
      select 1 from business.chat_estado e where e.cliente_id = o_cliente_id and p_mensaje_id <= e.eliminado_hasta
    ) then
      raise exception 'Mensaje no encontrado.' using errcode = '22023';
    end if;
    o_autor := 'asesor';
  elsif o_cliente_id = v_uid then
    o_autor := 'cliente';
  else
    raise exception 'sin permiso' using errcode = '42501';
  end if;
end
$$;

revoke all on function business.mensaje_actor(bigint) from public, anon, authenticated;

-- Reacciona con p_emoji. La misma reacción otra vez, o null, la quita; otra distinta la reemplaza. Devuelve la reacción
-- que queda (null = ninguna).
create function business.mensaje_reaccionar(p_mensaje_id bigint, p_emoji text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
  v_actual text;
begin
  select * into v_actor from business.mensaje_actor(p_mensaje_id);
  if v_emoji = '❤' then
    v_emoji := '❤️';
  end if;
  if v_emoji is not null and v_emoji not in ('👍', '❤️', '😂', '😮', '😢', '🙏') then
    raise exception 'Reacción no válida.' using errcode = '22023';
  end if;

  select r.emoji into v_actual from business.mensaje_reaccion r where r.mensaje_id = p_mensaje_id and r.user_id = auth.uid();
  if v_emoji is null or v_emoji = v_actual then
    delete from business.mensaje_reaccion r where r.mensaje_id = p_mensaje_id and r.user_id = auth.uid();
    return null;
  end if;
  insert into business.mensaje_reaccion (mensaje_id, user_id, autor, emoji)
  values (p_mensaje_id, auth.uid(), v_actor.o_autor, v_emoji)
  on conflict (mensaje_id, user_id) do update set emoji = excluded.emoji, autor = excluded.autor, created_at = now();
  return v_emoji;
end
$$;

-- Fija o desfija un mensaje del chat. Como mucho 3 fijados por chat: fijar otro desfija el más viejo.
create function business.mensaje_fijar(p_mensaje_id bigint, p_fijar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
begin
  select * into v_actor from business.mensaje_actor(p_mensaje_id);
  if not coalesce(p_fijar, false) then
    update business.mensaje_asesor m set fijado_en = null where m.id = p_mensaje_id and m.fijado_en is not null;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('business.mensaje_fijado:' || v_actor.o_cliente_id::text));
  if exists (select 1 from business.mensaje_asesor m where m.id = p_mensaje_id and m.fijado_en is not null) then
    return;
  end if;
  update business.mensaje_asesor m set fijado_en = null
  where m.id in (
    select f.id from business.mensaje_asesor f
    where f.cliente_id = v_actor.o_cliente_id and f.fijado_en is not null
    order by f.fijado_en desc, f.id desc
    offset 2
  );
  update business.mensaje_asesor m set fijado_en = clock_timestamp() where m.id = p_mensaje_id;
end
$$;

-- 8. Enviar con respuesta (reemplazan las de 20261004200001; mismas validaciones + p_responde_a) ---------------------

drop function business.enviar_mensaje_asesor(text, bigint, text, text);
drop function business.enviar_mensaje_staff(uuid, text, text, text, text);

create function business.enviar_mensaje_asesor(
  p_texto text,
  p_pedido_id bigint default null,
  p_adjunto_path text default null,
  p_adjunto_tipo text default null,
  p_responde_a bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_texto text := coalesce(trim(p_texto), '');
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if char_length(v_texto) = 0 and p_adjunto_path is null then
    raise exception 'Escribe un mensaje.' using errcode = '22023';
  end if;
  if char_length(v_texto) > 1000 then
    raise exception 'El mensaje es muy largo (máximo 1000 caracteres).' using errcode = '22023';
  end if;
  if p_pedido_id is not null
     and not exists (select 1 from business.pedido pe where pe.id = p_pedido_id and pe.cliente_id = v_uid) then
    raise exception 'Pedido no encontrado.' using errcode = '22023';
  end if;
  if p_responde_a is not null
     and not exists (select 1 from business.mensaje_asesor m where m.id = p_responde_a and m.cliente_id = v_uid) then
    raise exception 'El mensaje que respondes no existe.' using errcode = '22023';
  end if;
  perform business.validar_adjunto_chat(v_uid, p_adjunto_path, p_adjunto_tipo);
  if (select count(*) from business.mensaje_asesor m
      where m.cliente_id = v_uid and m.autor = 'cliente' and m.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Enviaste muchos mensajes seguidos. Espera unos minutos.' using errcode = 'P0001';
  end if;

  insert into business.mensaje_asesor (cliente_id, pedido_id, autor, texto, adjunto_path, adjunto_tipo, responde_a)
  values (v_uid, p_pedido_id, 'cliente', v_texto, p_adjunto_path, p_adjunto_tipo, p_responde_a)
  returning id into v_id;
  return v_id;
end
$$;

create function business.enviar_mensaje_staff(
  p_cliente_id uuid,
  p_texto text,
  p_via text default 'panel',
  p_adjunto_path text default null,
  p_adjunto_tipo text default null,
  p_responde_a bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texto text := coalesce(trim(p_texto), '');
  v_id bigint;
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if char_length(v_texto) = 0 and p_adjunto_path is null then
    raise exception 'Escribe un mensaje.' using errcode = '22023';
  end if;
  if char_length(v_texto) > 1000 then
    raise exception 'El mensaje es muy largo (máximo 1000 caracteres).' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_cliente_id) then
    raise exception 'Cliente no encontrado.' using errcode = '22023';
  end if;
  if p_responde_a is not null and not exists (
    select 1 from business.mensaje_asesor m
    where m.id = p_responde_a and m.cliente_id = p_cliente_id
      and m.id > coalesce((select e.eliminado_hasta from business.chat_estado e where e.cliente_id = p_cliente_id), 0)
  ) then
    raise exception 'El mensaje que respondes no existe.' using errcode = '22023';
  end if;
  perform business.validar_adjunto_chat(p_cliente_id, p_adjunto_path, p_adjunto_tipo);

  insert into business.mensaje_asesor (cliente_id, autor, texto, autor_via, adjunto_path, adjunto_tipo, responde_a)
  values (p_cliente_id, 'asesor', v_texto, left(coalesce(p_via, 'panel'), 80), p_adjunto_path, p_adjunto_tipo, p_responde_a)
  returning id into v_id;
  return v_id;
end
$$;

-- Abrir el chat también quita la marca de "no leído" puesta a mano.
create or replace function business.marcar_leidos_staff(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  update business.mensaje_asesor m set leido = true
  where m.cliente_id = p_cliente_id and m.autor = 'cliente' and not m.leido;
  update business.chat_estado e set no_leido_manual = false, updated_at = now()
  where e.cliente_id = p_cliente_id and e.no_leido_manual;
end
$$;

-- 9. Lecturas del panel ----------------------------------------------------------------------------------------------

-- Un chat por cliente con al menos un mensaje visible para el staff (id > eliminado_hasta), el más reciente primero.
-- sin_leer = mensajes visibles del cliente sin leer. etiquetas/carpetas = ids ordenados ('{}' = ninguna).
create function business.chat_bandeja_staff()
returns table (
  cliente_id uuid,
  username text,
  email text,
  phone text,
  ultimo_id bigint,
  ultimo_texto text,
  ultimo_autor text,
  ultimo_adjunto_tipo text,
  ultimo_created_at timestamptz,
  sin_leer int,
  fijado_en timestamptz,
  archivado_en timestamptz,
  no_leido_manual boolean,
  etiquetas bigint[],
  carpetas bigint[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  return query
    select
      u.id,
      c.username,
      coalesce(c.email, u.email)::text,
      c.phone,
      ult.id,
      ult.texto,
      ult.autor,
      ult.adjunto_tipo,
      ult.created_at,
      (select count(*)::int from business.mensaje_asesor s
       where s.cliente_id = u.id and s.autor = 'cliente' and not s.leido and s.id > coalesce(e.eliminado_hasta, 0)),
      e.fijado_en,
      e.archivado_en,
      coalesce(e.no_leido_manual, false),
      coalesce((select array_agg(ce.etiqueta_id order by ce.etiqueta_id)
                from business.chat_cliente_etiqueta ce where ce.cliente_id = u.id), '{}'::bigint[]),
      coalesce((select array_agg(cc.carpeta_id order by cc.carpeta_id)
                from business.chat_carpeta_cliente cc where cc.cliente_id = u.id), '{}'::bigint[])
    from auth.users u
    left join business.chat_estado e on e.cliente_id = u.id
    left join security.client c on c.id = u.id
    cross join lateral (
      select m.id, m.texto, m.autor, m.adjunto_tipo, m.created_at
      from business.mensaje_asesor m
      where m.cliente_id = u.id and m.id > coalesce(e.eliminado_hasta, 0)
      order by m.id desc
      limit 1
    ) ult
    order by ult.id desc;
end
$$;

-- Insignia del menú: mensajes visibles del cliente sin leer en todos los chats, + 1 por cada chat marcado "no leído" a
-- mano que no tiene ninguno real.
create function business.chat_sin_leer_staff()
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  return (
    select count(*)::int
    from business.mensaje_asesor m
    left join business.chat_estado e on e.cliente_id = m.cliente_id
    where m.autor = 'cliente' and not m.leido and m.id > coalesce(e.eliminado_hasta, 0)
  ) + (
    select count(*)::int
    from business.chat_estado e
    where e.no_leido_manual
      and exists (select 1 from business.mensaje_asesor m
                  where m.cliente_id = e.cliente_id and m.id > coalesce(e.eliminado_hasta, 0))
      and not exists (select 1 from business.mensaje_asesor m
                      where m.cliente_id = e.cliente_id and m.autor = 'cliente' and not m.leido
                        and m.id > coalesce(e.eliminado_hasta, 0))
  );
end
$$;

-- 10. Permisos de las funciones --------------------------------------------------------------------------------------

revoke all on function business.chat_etiqueta_guardar(bigint, text, text) from public, anon;
revoke all on function business.chat_etiqueta_eliminar(bigint) from public, anon;
revoke all on function business.chat_etiquetas_asignar(uuid, bigint[]) from public, anon;
revoke all on function business.chat_carpeta_guardar(bigint, text, text) from public, anon;
revoke all on function business.chat_carpeta_eliminar(bigint) from public, anon;
revoke all on function business.chat_carpetas_ordenar(bigint[]) from public, anon;
revoke all on function business.chat_carpeta_chats(bigint, uuid[]) from public, anon;
revoke all on function business.chat_carpetas_de_cliente(uuid, bigint[]) from public, anon;
revoke all on function business.chat_fijar(uuid, boolean) from public, anon;
revoke all on function business.chat_archivar(uuid, boolean) from public, anon;
revoke all on function business.chat_eliminar(uuid) from public, anon;
revoke all on function business.chat_marcar_no_leido(uuid, boolean) from public, anon;
revoke all on function business.chat_notas_guardar(uuid, text) from public, anon;
revoke all on function business.mensaje_reaccionar(bigint, text) from public, anon;
revoke all on function business.mensaje_fijar(bigint, boolean) from public, anon;
revoke all on function business.enviar_mensaje_asesor(text, bigint, text, text, bigint) from public, anon;
revoke all on function business.enviar_mensaje_staff(uuid, text, text, text, text, bigint) from public, anon;
revoke all on function business.marcar_leidos_staff(uuid) from public, anon;
revoke all on function business.chat_bandeja_staff() from public, anon;
revoke all on function business.chat_sin_leer_staff() from public, anon;

grant execute on function business.chat_etiqueta_guardar(bigint, text, text) to authenticated;
grant execute on function business.chat_etiqueta_eliminar(bigint) to authenticated;
grant execute on function business.chat_etiquetas_asignar(uuid, bigint[]) to authenticated;
grant execute on function business.chat_carpeta_guardar(bigint, text, text) to authenticated;
grant execute on function business.chat_carpeta_eliminar(bigint) to authenticated;
grant execute on function business.chat_carpetas_ordenar(bigint[]) to authenticated;
grant execute on function business.chat_carpeta_chats(bigint, uuid[]) to authenticated;
grant execute on function business.chat_carpetas_de_cliente(uuid, bigint[]) to authenticated;
grant execute on function business.chat_fijar(uuid, boolean) to authenticated;
grant execute on function business.chat_archivar(uuid, boolean) to authenticated;
grant execute on function business.chat_eliminar(uuid) to authenticated;
grant execute on function business.chat_marcar_no_leido(uuid, boolean) to authenticated;
grant execute on function business.chat_notas_guardar(uuid, text) to authenticated;
grant execute on function business.mensaje_reaccionar(bigint, text) to authenticated;
grant execute on function business.mensaje_fijar(bigint, boolean) to authenticated;
grant execute on function business.enviar_mensaje_asesor(text, bigint, text, text, bigint) to authenticated;
grant execute on function business.enviar_mensaje_staff(uuid, text, text, text, text, bigint) to authenticated;
grant execute on function business.marcar_leidos_staff(uuid) to authenticated;
grant execute on function business.chat_bandeja_staff() to authenticated;
grant execute on function business.chat_sin_leer_staff() to authenticated;
