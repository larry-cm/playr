-- Varias llaves Bre-B (pedido del usuario 2026-10-04): el admin agrega las que quiera (cada una con un nombre, p. ej.
-- "Nequi" o "Bancolombia") y el cliente elige a cuál transfiere. El pedido guarda la llave y el nombre con los que se
-- pagó, así el staff sabe dónde buscar el pago aunque la llave se cambie o se borre después.
-- También se quita el número de WhatsApp del asesor de business.ajuste: la app ya no lo usa (el contacto es el chat).

create table business.llave_breb (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(nombre) between 1 and 40),
  llave text not null unique check (char_length(llave) between 1 and 60 and llave ~ '^[[:alnum:]@._+-]+$'),
  -- Inactiva = no se le muestra al cliente (sin borrarla).
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table business.llave_breb enable row level security;
-- El cliente ve las activas (las necesita para pagar); el admin, todas.
create policy "logueado ve activas, admin todas" on business.llave_breb for select to authenticated
  using (activa or business.es_admin());
create policy "admin crea" on business.llave_breb for insert to authenticated with check (business.es_admin());
create policy "admin edita" on business.llave_breb for update to authenticated using (business.es_admin()) with check (business.es_admin());
create policy "admin borra" on business.llave_breb for delete to authenticated using (business.es_admin());

revoke all on business.llave_breb from public, anon, authenticated;
grant select, insert, update, delete on business.llave_breb to authenticated;
grant select on business.llave_breb to service_role;

-- La llave única que había en Ajustes pasa a ser la primera de la lista. La fila de business.ajuste se deja hasta
-- desplegar esta versión (la anterior la lee para mostrarla en la Tienda).
insert into business.llave_breb (nombre, llave)
select 'Llave Bre-B', trim(a.valor) from business.ajuste a where a.clave = 'llave_breb' and trim(a.valor) <> '';

delete from business.ajuste where clave = 'whatsapp_asesor';

-- Nombre de la llave a la que se pagó (los pedidos viejos quedan sin nombre).
alter table business.pedido add column llave_nombre text;

-- crear_pedido recibe la llave que eligió el cliente. Sin llave (p_llave_id null: la versión anterior de la app) usa la
-- primera activa, así los pagos siguen funcionando mientras se despliega.
drop function business.crear_pedido(bigint[], text, numeric);

create function business.crear_pedido(p_profile_ids bigint[], p_comprobante text, p_total_esperado numeric, p_llave_id bigint default null)
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
  order by l.id limit 1;
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

revoke all on function business.crear_pedido(bigint[], text, numeric, bigint) from public, anon;
grant execute on function business.crear_pedido(bigint[], text, numeric, bigint) to authenticated;
