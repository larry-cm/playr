-- Llave Bre-B predeterminada (pedido del usuario 2026-10-04): el admin elige cuál sale ya seleccionada cuando el
-- cliente paga. A lo sumo una; una llave oculta no puede serlo (ocultarla le quita la marca).

alter table business.llave_breb add column predeterminada boolean not null default false;
alter table business.llave_breb add constraint llave_breb_predeterminada_visible check (not predeterminada or activa);
create unique index llave_breb_una_predeterminada on business.llave_breb (predeterminada) where predeterminada;

-- Si ya hay llaves, la primera visible queda como predeterminada (la que se venía usando).
update business.llave_breb set predeterminada = true
where id = (select l.id from business.llave_breb l where l.activa order by l.id limit 1);

-- Cambia la predeterminada en un solo paso (quitar la marca de la anterior y ponerla en la nueva).
create function business.marcar_llave_predeterminada(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not business.es_admin() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if not exists (select 1 from business.llave_breb l where l.id = p_id and l.activa) then
    raise exception 'Solo una llave visible puede ser la predeterminada.' using errcode = '22023';
  end if;
  update business.llave_breb set predeterminada = false where predeterminada and id <> p_id;
  update business.llave_breb set predeterminada = true where id = p_id;
end
$$;

revoke all on function business.marcar_llave_predeterminada(bigint) from public, anon;
grant execute on function business.marcar_llave_predeterminada(bigint) to authenticated;

-- Sin llave elegida (versión anterior de la app), crear_pedido usa la predeterminada antes que la más vieja.
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

  select array_agg(distinct x) into v_ids from unnest(p_profile_ids) as x where x is not null;
  if coalesce(cardinality(v_ids), 0) = 0 or cardinality(v_ids) > 20 then
    raise exception 'Elige entre 1 y 20 perfiles.' using errcode = '22023';
  end if;

  if p_comprobante is null or split_part(p_comprobante, '/', 1) <> v_uid::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'comprobantes' and o.name = p_comprobante) then
    raise exception 'No encontramos el comprobante. Súbelo de nuevo.' using errcode = '22023';
  end if;
  if exists (select 1 from business.pedido pe where pe.comprobante_path = p_comprobante) then
    raise exception 'Este comprobante ya está en otro pedido.' using errcode = '22023';
  end if;

  if (select count(*) from business.pedido pe where pe.cliente_id = v_uid and pe.estado = 'pendiente') >= 3 then
    raise exception 'Ya tienes 3 pagos por verificar. Espera a que los revisemos.' using errcode = 'P0001';
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
