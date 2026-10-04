-- Bandeja de mensajes del staff en Playr (/administrar/mensajes): un chat por cliente. `leido` en mensaje_asesor pasa a
-- significar "lo vio quien lo recibe": las respuestas del asesor, el cliente; los mensajes del cliente, el staff.

create index mensaje_asesor_cliente_sin_leer on business.mensaje_asesor (cliente_id) where autor = 'cliente' and not leido;

-- El staff contesta desde el panel. El servidor después lo copia al tema del cliente en Telegram.
create function business.enviar_mensaje_staff(p_cliente_id uuid, p_texto text, p_via text default 'panel')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texto text := trim(p_texto);
  v_id bigint;
begin
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if v_texto is null or char_length(v_texto) = 0 then
    raise exception 'Escribe un mensaje.' using errcode = '22023';
  end if;
  if char_length(v_texto) > 1000 then
    raise exception 'El mensaje es muy largo (máximo 1000 caracteres).' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_cliente_id) then
    raise exception 'Cliente no encontrado.' using errcode = '22023';
  end if;

  insert into business.mensaje_asesor (cliente_id, autor, texto, autor_via)
  values (p_cliente_id, 'asesor', v_texto, left(coalesce(p_via, 'panel'), 80))
  returning id into v_id;
  return v_id;
end
$$;

-- El staff abrió la conversación de un cliente: sus mensajes quedan leídos.
create function business.marcar_leidos_staff(p_cliente_id uuid)
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
end
$$;

revoke all on function business.enviar_mensaje_staff(uuid, text, text) from public, anon;
revoke all on function business.marcar_leidos_staff(uuid) from public, anon;
grant execute on function business.enviar_mensaje_staff(uuid, text, text) to authenticated;
grant execute on function business.marcar_leidos_staff(uuid) to authenticated;
