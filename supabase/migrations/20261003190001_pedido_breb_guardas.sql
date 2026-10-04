-- Guardas de los pedidos Bre-B (revisión RDD de 20261003180001):
-- 1. Un perfil 'reservado' solo cambia de estado por crear/aprobar/rechazar pedido. Antes el staff podía devolverlo
--    a 'disponible' desde Perfiles, otro cliente lo reservaba y al aprobar el primer pedido se entregaba dos veces.
-- 2. aprobar_pedido exige que todos los perfiles del pedido sigan reservados.
-- 3. crear_pedido recibe el total que vio el cliente (lo que transfirió) y falla si el precio cambió entretanto.
-- 4. Un comprobante respalda un solo pedido.

create unique index pedido_comprobante_unico on business.pedido (comprobante_path);

-- Las funciones de pedido encienden esta marca (local a la transacción) antes de tocar estados reservados.
create function business.profile_guarda_reservado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado
     and (old.estado = 'reservado' or new.estado = 'reservado')
     and coalesce(current_setting('playr.pedido', true), '') <> 'on' then
    raise exception 'Este perfil está reservado por un pago por verificar: apruébalo o recházalo en Pedidos.' using errcode = 'P0001';
  end if;
  return new;
end
$$;

revoke all on function business.profile_guarda_reservado() from public, anon, authenticated;

create trigger profile_guarda_reservado before update of estado on business.profile
  for each row execute function business.profile_guarda_reservado();

drop function business.crear_pedido(bigint[], text);

create function business.crear_pedido(p_profile_ids bigint[], p_comprobante text, p_total_esperado numeric)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ids bigint[];
  v_llave text;
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

  select nullif(trim(a.valor), '') into v_llave from business.ajuste a where a.clave = 'llave_breb';
  if v_llave is null then
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

  insert into business.pedido (cliente_id, total, llave_breb, comprobante_path)
  values (v_uid, v_total, v_llave, p_comprobante)
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

create or replace function business.aprobar_pedido(p_pedido_id bigint, p_via text default 'panel')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado business.estado_pedido;
  v_items int;
  v_reservados int;
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select pe.estado into v_estado from business.pedido pe where pe.id = p_pedido_id for update;
  if v_estado is null then
    raise exception 'No existe el pedido.' using errcode = 'P0002';
  end if;
  if v_estado <> 'pendiente' then
    raise exception 'El pedido ya fue revisado.' using errcode = 'P0001';
  end if;

  select count(*), count(*) filter (where p.estado = 'reservado') into v_items, v_reservados
  from business.pedido_item i join business.profile p on p.id = i.profile_id
  where i.pedido_id = p_pedido_id;
  if v_items = 0 or v_reservados <> v_items then
    raise exception 'Algún perfil del pedido ya no está reservado: no se puede aprobar. Rechaza el pedido y revisa sus perfiles.' using errcode = 'P0001';
  end if;

  update business.pedido pe
  set estado = 'aprobado', revisado_at = now(), revisado_by = auth.uid(), revisado_via = left(coalesce(p_via, 'panel'), 80)
  where pe.id = p_pedido_id;

  perform set_config('playr.pedido', 'on', true);
  update business.profile p set estado = 'vendido'
  where p.estado = 'reservado' and p.id in (select i.profile_id from business.pedido_item i where i.pedido_id = p_pedido_id);
  perform set_config('playr.pedido', '', true);
end
$$;

create or replace function business.rechazar_pedido(p_pedido_id bigint, p_motivo text, p_via text default 'panel')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado business.estado_pedido;
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select pe.estado into v_estado from business.pedido pe where pe.id = p_pedido_id for update;
  if v_estado is null then
    raise exception 'No existe el pedido.' using errcode = 'P0002';
  end if;
  if v_estado <> 'pendiente' then
    raise exception 'El pedido ya fue revisado.' using errcode = 'P0001';
  end if;

  update business.pedido pe
  set estado = 'rechazado', motivo_rechazo = left(nullif(trim(p_motivo), ''), 300),
      revisado_at = now(), revisado_by = auth.uid(), revisado_via = left(coalesce(p_via, 'panel'), 80)
  where pe.id = p_pedido_id;

  perform set_config('playr.pedido', 'on', true);
  update business.profile p set estado = 'disponible'
  where p.estado = 'reservado' and p.id in (select i.profile_id from business.pedido_item i where i.pedido_id = p_pedido_id);
  perform set_config('playr.pedido', '', true);
end
$$;

revoke all on function business.crear_pedido(bigint[], text, numeric) from public, anon;
grant execute on function business.crear_pedido(bigint[], text, numeric) to authenticated;
