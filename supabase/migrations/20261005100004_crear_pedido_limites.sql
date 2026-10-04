-- Auditoría de seguridad 2026-10-04: un cliente podía dejar la Tienda sin stock con un "comprobante" cualquiera
-- (3 pedidos pendientes x 20 perfiles, sin vencimiento) y el tope de pendientes se saltaba con llamadas en paralelo
-- (el conteo no estaba serializado). Decisión del usuario: 1 pedido pendiente por cliente, con hasta 5 perfiles; los
-- pendientes no vencen. Además un cliente dado de baja (security.client.exist = false) ya no puede pedir.
-- Mismo cuerpo que 20261004220001 salvo esos tres cambios.

create or replace function business.crear_pedido(p_profile_ids bigint[], p_comprobante text, p_total_esperado numeric, p_llave_id bigint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ids bigint[];
  v_llave text;
  v_llave_nombre text;
  v_total numeric(12,2);
  v_disponibles int;
  v_pedido bigint;
begin
  if v_uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if not exists (select 1 from security.client c where c.id = v_uid and c.exist) then
    raise exception 'Tu cuenta está dada de baja. Contacta a soporte.' using errcode = 'P0001';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_profile_ids) as x where x is not null;
  if coalesce(cardinality(v_ids), 0) = 0 or cardinality(v_ids) > 5 then
    raise exception 'Elige entre 1 y 5 perfiles.' using errcode = '22023';
  end if;

  if p_comprobante is null or split_part(p_comprobante, '/', 1) <> v_uid::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'comprobantes' and o.name = p_comprobante) then
    raise exception 'No encontramos el comprobante. Súbelo de nuevo.' using errcode = '22023';
  end if;
  if exists (select 1 from business.pedido pe where pe.comprobante_path = p_comprobante) then
    raise exception 'Este comprobante ya está en otro pedido.' using errcode = '22023';
  end if;

  -- Un pedido a la vez por cliente: dos llamadas en paralelo esperan acá y la segunda ya ve el pendiente.
  perform pg_advisory_xact_lock(hashtext('crear_pedido:' || v_uid::text));
  if exists (select 1 from business.pedido pe where pe.cliente_id = v_uid and pe.estado = 'pendiente') then
    raise exception 'Ya tienes un pago por verificar. Espera a que lo revisemos.' using errcode = 'P0001';
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

  insert into business.pedido (cliente_id, total, llave_breb, llave_nombre, comprobante_path)
  values (v_uid, v_total, v_llave, v_llave_nombre, p_comprobante)
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
