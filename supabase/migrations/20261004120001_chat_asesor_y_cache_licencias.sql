-- Seguimiento de los pedidos Bre-B:
-- 1. Chat privado cliente ↔ asesor. El cliente escribe desde Playr; el servidor reenvía cada mensaje al Telegram del
--    asesor y anota en business.telegram_hilo de qué cliente es ese mensaje de Telegram. El asesor contesta
--    respondiendo ese mensaje (o el aviso de un pedido) y el webhook (service_role) guarda la respuesta.
-- 2. Caché cifrada de "Mis licencias" del proveedor: leerla en vivo tarda varios segundos (login + scraping) en cada
--    "Ver accesos". La lee y escribe el servidor (staff o service_role); el cliente nunca la ve.
-- 3. El bucket 'comprobantes' acepta los formatos que comparten las apps de bancos (HEIC/HEIF y GIF además de
--    JPG/PNG/WEBP/PDF).

-- 1. Chat ------------------------------------------------------------------------------------------------------------

create table business.mensaje_asesor (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references auth.users(id),
  -- Pedido del que habla el mensaje (opcional): el asesor lo ve en Telegram.
  pedido_id bigint references business.pedido(id) on delete set null,
  autor text not null check (autor in ('cliente', 'asesor')),
  texto text not null check (char_length(texto) between 1 and 1000),
  -- Respuestas del asesor: 'telegram:<usuario>'.
  autor_via text,
  leido boolean not null default false,
  created_at timestamptz not null default now()
);

create index mensaje_asesor_cliente on business.mensaje_asesor (cliente_id, id desc);

-- Mensaje de Telegram (aviso de pedido o mensaje reenviado del cliente) → cliente al que va la respuesta del asesor.
-- Un mensaje del cliente puede quedar en varios chats (un privado por asesor): una fila por copia.
create table business.telegram_hilo (
  chat_id bigint not null,
  message_id bigint not null,
  cliente_id uuid not null references auth.users(id),
  pedido_id bigint references business.pedido(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (chat_id, message_id)
);

alter table business.telegram_hilo enable row level security;
revoke all on business.telegram_hilo from public, anon, authenticated;
grant select, insert on business.telegram_hilo to service_role;

alter table business.mensaje_asesor enable row level security;
create policy "cliente propio o staff" on business.mensaje_asesor for select to authenticated
  using (cliente_id = (select auth.uid()) or business.es_staff());

revoke all on business.mensaje_asesor from public, anon, authenticated;
grant select on business.mensaje_asesor to authenticated;
grant select, insert, update on business.mensaje_asesor to service_role;

-- El cliente escribe solo por acá: su propio mensaje, de un pedido suyo, con límite contra el spam.
create function business.enviar_mensaje_asesor(p_texto text, p_pedido_id bigint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_texto text := trim(p_texto);
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if v_texto is null or char_length(v_texto) = 0 then
    raise exception 'Escribe un mensaje.' using errcode = '22023';
  end if;
  if char_length(v_texto) > 1000 then
    raise exception 'El mensaje es muy largo (máximo 1000 caracteres).' using errcode = '22023';
  end if;
  if p_pedido_id is not null
     and not exists (select 1 from business.pedido pe where pe.id = p_pedido_id and pe.cliente_id = v_uid) then
    raise exception 'Pedido no encontrado.' using errcode = '22023';
  end if;
  if (select count(*) from business.mensaje_asesor m
      where m.cliente_id = v_uid and m.autor = 'cliente' and m.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Enviaste muchos mensajes seguidos. Espera unos minutos.' using errcode = 'P0001';
  end if;

  insert into business.mensaje_asesor (cliente_id, pedido_id, autor, texto)
  values (v_uid, p_pedido_id, 'cliente', v_texto)
  returning id into v_id;
  return v_id;
end
$$;

-- Marca como leídas las respuestas del asesor al cliente que llama.
create function business.marcar_mensajes_leidos()
returns void
language sql
security definer
set search_path = ''
as $$
  update business.mensaje_asesor m set leido = true
  where m.cliente_id = auth.uid() and m.autor = 'asesor' and not m.leido
$$;

revoke all on function business.enviar_mensaje_asesor(text, bigint) from public, anon;
revoke all on function business.marcar_mensajes_leidos() from public, anon;
grant execute on function business.enviar_mensaje_asesor(text, bigint) to authenticated;
grant execute on function business.marcar_mensajes_leidos() to authenticated;

-- 2. Caché de licencias del proveedor --------------------------------------------------------------------------------

create table business.licencias_cache (
  id smallint primary key default 1 check (id = 1),
  -- JSON de las licencias, cifrado con ACCOUNT_ENC_KEY (pgp_sym_encrypt, base64), igual que las contraseñas.
  datos_enc text not null,
  leido_at timestamptz not null default now()
);

alter table business.licencias_cache enable row level security;
revoke all on business.licencias_cache from public, anon, authenticated;

create function business.leer_licencias_cache(p_enc_key text)
returns table (datos text, leido_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  return query
    select extensions.pgp_sym_decrypt(decode(c.datos_enc, 'base64'), p_enc_key), c.leido_at
    from business.licencias_cache c where c.id = 1;
end
$$;

create function business.guardar_licencias_cache(p_datos text, p_enc_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  insert into business.licencias_cache (id, datos_enc, leido_at)
  values (1, encode(extensions.pgp_sym_encrypt(p_datos, p_enc_key), 'base64'), now())
  on conflict (id) do update set datos_enc = excluded.datos_enc, leido_at = excluded.leido_at;
end
$$;

revoke all on function business.leer_licencias_cache(text) from public, anon;
revoke all on function business.guardar_licencias_cache(text, text) from public, anon;
grant execute on function business.leer_licencias_cache(text) to authenticated, service_role;
grant execute on function business.guardar_licencias_cache(text, text) to authenticated, service_role;

-- 3. Formatos del comprobante ----------------------------------------------------------------------------------------

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'application/pdf']
where id = 'comprobantes';
