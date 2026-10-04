-- Auditoría de seguridad 2026-10-04: la clave pgcrypto de las contraseñas (ACCOUNT_ENC_KEY) viajaba desde la app como
-- argumento de cada RPC (decrypt_*, *_licencias_cache, registrar_licencias, encrypt_account_password), así que podía
-- quedar en los logs de Postgres / de la API. Ahora vive en Supabase Vault (secreto `account_enc_key`, mismo valor que
-- la ACCOUNT_ENC_KEY de siempre) y solo la leen estas funciones por dentro, con business.enc_key(); la app ya no la
-- necesita. El secreto NO se crea acá (nunca en un archivo): se crea aparte, una sola vez, antes de aplicar esto:
--   select vault.create_secret('<ACCOUNT_ENC_KEY>', 'account_enc_key', 'Clave pgcrypto de contraseñas de cuentas');
-- Mismos cuerpos y permisos que en la DB salvo: sin el parámetro de la clave, y encrypt_account_password pasa a
-- security definer (tiene que leer el Vault) con la misma guarda que las demás (staff o service_role).

-- Solo la llaman las funciones de abajo (corren como su dueño): nadie más tiene EXECUTE.
create function business.enc_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'account_enc_key' limit 1;
  if v_key is null or length(v_key) < 8 then
    raise exception 'falta la clave de cifrado en Vault (secreto account_enc_key)';
  end if;
  return v_key;
end
$$;

revoke all on function business.enc_key() from public, anon, authenticated, service_role;

-- Antes de quitar las funciones viejas, el secreto del Vault tiene que abrir una contraseña ya guardada: con una clave
-- equivocada la migración se aborta entera (si no, nadie podría leer sus accesos y lo nuevo quedaría con otra clave).
do $$
declare
  v_cifrada text;
begin
  select a.password_enc into v_cifrada from business.account a where a.password_enc is not null order by a.id limit 1;
  if v_cifrada is not null then
    begin
      perform extensions.pgp_sym_decrypt(decode(v_cifrada, 'base64'), business.enc_key());
    exception when others then
      raise exception 'el secreto account_enc_key del Vault no descifra las contraseñas guardadas: %', sqlerrm;
    end;
  end if;
end
$$;

drop function business.decrypt_account_password(bigint, text);
drop function business.decrypt_profile_password(bigint, text);
drop function business.leer_licencias_cache(text);
drop function business.guardar_licencias_cache(text, text);
drop function business.encrypt_account_password(text, text);
drop function business.registrar_licencias(jsonb, text);

create function business.decrypt_account_password(p_account_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enc text;
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select a.password_enc into v_enc from business.account a where a.id = p_account_id and a.exist;
  if v_enc is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(decode(v_enc, 'base64'), business.enc_key());
end
$$;

create function business.decrypt_profile_password(p_profile_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enc text;
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select p.password_enc into v_enc from business.profile p where p.id = p_profile_id and p.exist;
  if v_enc is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(decode(v_enc, 'base64'), business.enc_key());
end
$$;

create function business.leer_licencias_cache()
returns table(datos text, leido_at timestamptz)
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
    select extensions.pgp_sym_decrypt(decode(c.datos_enc, 'base64'), business.enc_key()), c.leido_at
    from business.licencias_cache c where c.id = 1;
end
$$;

create function business.guardar_licencias_cache(p_datos text)
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
  values (1, encode(extensions.pgp_sym_encrypt(p_datos, business.enc_key()), 'base64'), now())
  on conflict (id) do update set datos_enc = excluded.datos_enc, leido_at = excluded.leido_at;
end
$$;

-- Antes era security invoker y recibía la clave; ahora la lee del Vault, así que exige staff (editPerfilAction, con la
-- sesión del staff) o service_role, igual que las demás.
create function business.encrypt_account_password(password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  return encode(extensions.pgp_sym_encrypt(password, business.enc_key()), 'base64');
end
$$;

create function business.registrar_licencias(p_grupos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g jsonb;
  v_platform bigint;
  v_access business.access_type;
  v_account bigint;
  v_vence date;
  v_costo numeric;
  v_reg int := 0;
  v_dup int := 0;
  v_prod int := 0;
  v_key text;
begin
  if not business.es_staff() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  v_key := business.enc_key();
  if p_grupos is null or jsonb_typeof(p_grupos) <> 'array' then
    raise exception 'p_grupos debe ser un arreglo';
  end if;

  -- serializa los registros: el chequeo de duplicados de abajo no es atomico entre transacciones concurrentes
  perform pg_advisory_xact_lock(hashtext('business.registrar_licencias'));

  for g in select * from jsonb_array_elements(p_grupos) loop
    v_platform := (g->>'platform_id')::bigint;
    v_access := (g->>'access_type')::business.access_type;
    v_vence := nullif(g->>'vence', '')::date;
    v_costo := nullif(g->>'costo', '')::numeric;

    if coalesce(g->>'email', '') = '' or coalesce(g->>'password', '') = '' or coalesce(g->>'perfil', '') = '' then
      raise exception 'grupo incompleto: faltan email, password o perfil';
    end if;
    if not exists (select 1 from business.platform where id = v_platform and exist) then
      raise exception 'plataforma % inexistente', v_platform;
    end if;

    if exists (
      select 1 from business.account a join business.profile p on p.account_id = a.id
      where a.exist and p.exist and a.platform_id = v_platform
        and lower(a.email) = lower(g->>'email') and p.nombre_perfil = g->>'perfil'
        and a.fecha_vencimiento is not distinct from v_vence
    ) then
      v_dup := v_dup + 1;
      continue;
    end if;

    -- Misma plataforma + mismo correo = el mismo login real: se agrupa ahí en vez de abrir una cuenta
    -- nueva. Sin esto, cada perfil comprado de una cuenta de 5 quedaba en su propia cuenta de 1.
    select id into v_account
      from business.account
     where exist and platform_id = v_platform and lower(email) = lower(g->>'email')
     order by id
     limit 1;

    if v_account is null then
      insert into business.account (platform_id, access_type, sourced_from_listing_id, email, password_enc, perfil_max, fecha_vencimiento, costo)
      values (v_platform, v_access, nullif(g->>'listing_id', '')::bigint, g->>'email',
              encode(extensions.pgp_sym_encrypt(g->>'password', v_key), 'base64'),
              1, v_vence, v_costo)
      returning id into v_account;
    end if;

    insert into business.profile (account_id, nombre_perfil, pin, estado)
    values (v_account, g->>'perfil', nullif(g->>'pin', ''), 'disponible');
    v_reg := v_reg + 1;

    -- perfil_max es la capacidad conocida del login: nunca debe quedar por debajo de los perfiles
    -- vivos que realmente tiene (no-op para una cuenta recién creada, que ya nace en 1/1).
    update business.account
       set perfil_max = greatest(perfil_max, (select count(*) from business.profile p where p.account_id = v_account and p.exist))
     where id = v_account;

    if not exists (select 1 from business.producto where platform_id = v_platform and access_type = v_access and exist) then
      -- el costo de referencia sale de la oferta vigente del proveedor (igual que "Agregar producto"); puede no haber
      select o.costo into v_costo from business.oferta_proveedor o where o.platform_id = v_platform and o.access_type = v_access;

      update business.producto
         set exist = true, costo = v_costo, precio_venta = null
       where id = (select id from business.producto where platform_id = v_platform and access_type = v_access and not exist order by id desc limit 1);
      if not found then
        insert into business.producto (platform_id, access_type, costo, precio_venta) values (v_platform, v_access, v_costo, null);
      end if;
      v_prod := v_prod + 1;
    end if;
  end loop;

  return jsonb_build_object('registradas', v_reg, 'duplicadas', v_dup, 'productos_creados', v_prod);
end
$$;

revoke all on function business.decrypt_account_password(bigint) from public, anon;
revoke all on function business.decrypt_profile_password(bigint) from public, anon;
revoke all on function business.leer_licencias_cache() from public, anon;
revoke all on function business.guardar_licencias_cache(text) from public, anon;
revoke all on function business.encrypt_account_password(text) from public, anon;
revoke all on function business.registrar_licencias(jsonb) from public, anon;
grant execute on function business.decrypt_account_password(bigint) to authenticated, service_role;
grant execute on function business.decrypt_profile_password(bigint) to authenticated, service_role;
grant execute on function business.leer_licencias_cache() to authenticated, service_role;
grant execute on function business.guardar_licencias_cache(text) to authenticated, service_role;
grant execute on function business.encrypt_account_password(text) to authenticated;
grant execute on function business.registrar_licencias(jsonb) to authenticated;
