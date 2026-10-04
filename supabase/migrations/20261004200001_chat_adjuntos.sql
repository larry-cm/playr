-- Imágenes y notas de voz en el chat cliente ↔ asesor (las dos direcciones, también desde Telegram).
-- El archivo va al bucket privado 'chat' en la carpeta del cliente ('<cliente_id>/...'): el cliente sube y lee solo la
-- suya, el staff todas; lo que llega de Telegram lo sube el webhook (service_role). El mensaje guarda la ruta y el tipo;
-- con adjunto el texto puede ir vacío (es el pie de la imagen o del audio).

alter table business.mensaje_asesor
  add column adjunto_path text,
  add column adjunto_tipo text check (adjunto_tipo in ('imagen', 'audio')),
  add constraint mensaje_asesor_adjunto_completo check ((adjunto_path is null) = (adjunto_tipo is null));

alter table business.mensaje_asesor drop constraint mensaje_asesor_texto_check;
alter table business.mensaje_asesor add constraint mensaje_asesor_texto_check
  check (char_length(texto) <= 1000 and (char_length(texto) >= 1 or adjunto_path is not null));

-- Bucket -------------------------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 10485760, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'
]);

create policy "chat sube su carpeta o staff" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and ((storage.foldername(name))[1] = (select auth.uid())::text or business.es_staff()));
create policy "chat lee propio o staff" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and ((storage.foldername(name))[1] = (select auth.uid())::text or business.es_staff()));

-- El adjunto de un mensaje: archivo ya subido a la carpeta del cliente. Error si no sirve.
create function business.validar_adjunto_chat(p_cliente_id uuid, p_path text, p_tipo text)
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
  if p_tipo is null or p_tipo not in ('imagen', 'audio') or p_path is null
     or split_part(p_path, '/', 1) <> p_cliente_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'chat' and o.name = p_path) then
    raise exception 'El archivo adjunto no es válido. Vuelve a adjuntarlo.' using errcode = '22023';
  end if;
end
$$;

revoke all on function business.validar_adjunto_chat(uuid, text, text) from public, anon, authenticated;

-- RPCs del chat con adjunto (reemplazan las de solo texto) -----------------------------------------------------------

drop function business.enviar_mensaje_asesor(text, bigint);
drop function business.enviar_mensaje_staff(uuid, text, text);

create function business.enviar_mensaje_asesor(
  p_texto text,
  p_pedido_id bigint default null,
  p_adjunto_path text default null,
  p_adjunto_tipo text default null
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
  perform business.validar_adjunto_chat(v_uid, p_adjunto_path, p_adjunto_tipo);
  if (select count(*) from business.mensaje_asesor m
      where m.cliente_id = v_uid and m.autor = 'cliente' and m.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Enviaste muchos mensajes seguidos. Espera unos minutos.' using errcode = 'P0001';
  end if;

  insert into business.mensaje_asesor (cliente_id, pedido_id, autor, texto, adjunto_path, adjunto_tipo)
  values (v_uid, p_pedido_id, 'cliente', v_texto, p_adjunto_path, p_adjunto_tipo)
  returning id into v_id;
  return v_id;
end
$$;

create function business.enviar_mensaje_staff(
  p_cliente_id uuid,
  p_texto text,
  p_via text default 'panel',
  p_adjunto_path text default null,
  p_adjunto_tipo text default null
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
  perform business.validar_adjunto_chat(p_cliente_id, p_adjunto_path, p_adjunto_tipo);

  insert into business.mensaje_asesor (cliente_id, autor, texto, autor_via, adjunto_path, adjunto_tipo)
  values (p_cliente_id, 'asesor', v_texto, left(coalesce(p_via, 'panel'), 80), p_adjunto_path, p_adjunto_tipo)
  returning id into v_id;
  return v_id;
end
$$;

revoke all on function business.enviar_mensaje_asesor(text, bigint, text, text) from public, anon;
revoke all on function business.enviar_mensaje_staff(uuid, text, text, text, text) from public, anon;
grant execute on function business.enviar_mensaje_asesor(text, bigint, text, text) to authenticated;
grant execute on function business.enviar_mensaje_staff(uuid, text, text, text, text) to authenticated;
