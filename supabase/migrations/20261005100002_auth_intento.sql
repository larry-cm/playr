-- Auditoría de seguridad 2026-10-04: el login y "olvidé mi contraseña" corren en el servidor, así que Supabase Auth
-- ve siempre la IP de Vercel y su límite por IP no frena a nadie (y un atacante agotándolo bloquearía el login de
-- todos). Límite propio, que la app consulta con service_role antes de llamar a Auth (app/lib/limite-auth.ts).
--
-- Cada intento se anota ANTES de llamar a Auth y en la misma transacción que lo cuenta (con un candado por correo):
-- una ráfaga de peticiones en paralelo no pasa el tope. Un login correcto borra los intentos de ese correo y una falla
-- de Auth que no es del usuario (429/5xx) borra el suyo.
--   login:     5 por correo+IP o 30 por IP en 15 min. Por correo solo (cualquier IP) el tope es 50: con 5 fallos
--              desde otra IP no se le bloquea la cuenta a nadie, y bloquearla exige muchas IPs (queda el aviso).
--   recuperar: 3 por correo o 10 por IP en 1 h.

create table security.auth_intento (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('login', 'recuperar')),
  ip text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create index auth_intento_email on security.auth_intento (tipo, email, created_at);
create index auth_intento_ip on security.auth_intento (tipo, ip, created_at);

alter table security.auth_intento enable row level security;
revoke all on security.auth_intento from anon, authenticated;

-- Devuelve el id del intento anotado, o null si hay que cortar (motivo: ip, correo_ip o correo).
create function security.auth_intentar(p_tipo text, p_ip text, p_email text, out intento_id bigint, out motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := left(lower(p_email), 320);
  v_ip text := left(p_ip, 64);
  v_ventana interval := case p_tipo when 'login' then interval '15 minutes' else interval '1 hour' end;
  v_max_ip int := case p_tipo when 'login' then 30 else 10 end;
  v_max_email int := case p_tipo when 'login' then 50 else 3 end;
begin
  if p_tipo not in ('login', 'recuperar') then
    raise exception 'tipo inválido' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('auth_intento:' || v_email));
  delete from security.auth_intento where created_at < now() - interval '1 day';

  if (select count(*) from security.auth_intento a
      where a.tipo = p_tipo and a.ip = v_ip and a.created_at > now() - v_ventana)
     >= v_max_ip then
    motivo := 'ip';
  elsif p_tipo = 'login' and (select count(*) from security.auth_intento a
      where a.tipo = 'login' and a.email = v_email and a.ip = v_ip and a.created_at > now() - v_ventana) >= 5 then
    motivo := 'correo_ip';
  elsif (select count(*) from security.auth_intento a
      where a.tipo = p_tipo and a.email = v_email and a.created_at > now() - v_ventana)
     >= v_max_email then
    motivo := 'correo';
  else
    insert into security.auth_intento (tipo, ip, email) values (p_tipo, v_ip, v_email) returning id into intento_id;
  end if;
end
$$;

create function security.auth_descartar(p_intento_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from security.auth_intento where id = p_intento_id;
$$;

create function security.auth_limpiar(p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from security.auth_intento where tipo = 'login' and email = lower(p_email);
$$;

revoke all on function security.auth_intentar(text, text, text) from public, anon, authenticated;
revoke all on function security.auth_descartar(bigint) from public, anon, authenticated;
revoke all on function security.auth_limpiar(text) from public, anon, authenticated;
grant execute on function security.auth_intentar(text, text, text) to service_role;
grant execute on function security.auth_descartar(bigint) to service_role;
grant execute on function security.auth_limpiar(text) to service_role;
