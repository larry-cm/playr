-- Corrige el modelo de negocio: una cuenta es el login real que agrupa VARIOS perfiles de una misma
-- plataforma (lo que compramos que "pone 5 perfiles"); un perfil comprado suelto no es una cuenta.
--
-- registrar_licencias creaba una business.account NUEVA por cada credencial registrada, siempre con
-- perfil_max=1 — así, comprar un perfil individual y comprar el segundo perfil de una cuenta de 5
-- terminaban indistinguibles: cada uno "replicaba" su perfil dentro de una cuenta propia de 1 solo
-- perfil. La cuenta real (mismo platform_id + email) nunca se reconocía entre compras.
--
-- Fix: antes de insertar una cuenta nueva, se busca una cuenta viva con el mismo platform_id + email
-- (case-insensitive) — es el mismo login del proveedor — y el perfil nuevo se agrega ahí. perfil_max
-- se sube junto con la cantidad real de perfiles vivos para que nunca muestre menos de los que tiene.
--
-- Con esto, /administrar/cuentas (ver get-all-cuentas-action.ts) puede filtrar a perfiles_total > 1:
-- una cuenta con un solo perfil vivo es, por definición, un perfil comprado suelto, no una cuenta
-- agrupadora — sigue apareciendo en /administrar/perfiles igual que siempre.
create or replace function business.registrar_licencias(p_grupos jsonb, p_enc_key text)
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
begin
  if not business.es_staff() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if p_enc_key is null or length(p_enc_key) < 8 then
    raise exception 'clave de cifrado invalida';
  end if;
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
              encode(extensions.pgp_sym_encrypt(g->>'password', p_enc_key), 'base64'),
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
