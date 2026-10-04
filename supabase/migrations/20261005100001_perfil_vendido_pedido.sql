-- Auditoría de seguridad 2026-10-04: los accesos de un pedido aprobado se buscaban solo por pedido_item, así que
-- si un perfil se liberaba y se revendía, el comprador anterior seguía leyendo la clave vigente. Desde acá el
-- perfil guarda el pedido que lo vendió y solo ese pedido ve sus accesos (getAccesosPedidoAction).

alter table business.profile
  add column vendido_pedido_id bigint references business.pedido (id) on delete set null;

create index profile_vendido_pedido_id on business.profile (vendido_pedido_id) where vendido_pedido_id is not null;

-- Si el perfil vuelve a la venta (o se reserva para otro pedido), el comprador anterior pierde el acceso. Y solo
-- pedido_liga_perfiles lo escribe: el staff edita perfiles por RLS, pero no puede reasignar un comprador a mano.
create function business.profile_suelta_pedido()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.vendido_pedido_id is distinct from old.vendido_pedido_id
     and coalesce(current_setting('playr.liga', true), '') <> 'on' then
    new.vendido_pedido_id := old.vendido_pedido_id;
  end if;
  if new.estado in ('disponible', 'reservado') and old.estado is distinct from new.estado then
    new.vendido_pedido_id := null;
  end if;
  return new;
end
$$;

revoke all on function business.profile_suelta_pedido() from public, anon, authenticated;

create trigger profile_suelta_pedido before update on business.profile
  for each row execute function business.profile_suelta_pedido();

-- Al aprobar un pedido, sus perfiles quedan ligados a él (sin redefinir aprobar_pedido).
create function business.pedido_liga_perfiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'aprobado' and old.estado is distinct from 'aprobado' then
    perform set_config('playr.liga', 'on', true);
    update business.profile p set vendido_pedido_id = new.id
    from business.pedido_item i
    where i.pedido_id = new.id and p.id = i.profile_id;
    perform set_config('playr.liga', '', true);
  end if;
  return null;
end
$$;

revoke all on function business.pedido_liga_perfiles() from public, anon, authenticated;

create trigger pedido_liga_perfiles after update of estado on business.pedido
  for each row execute function business.pedido_liga_perfiles();

-- Perfiles ya vendidos (o en soporte con su comprador): el último pedido aprobado que los incluye.
select set_config('playr.liga', 'on', true);
update business.profile p
set vendido_pedido_id = ult.pedido_id
from (
  select distinct on (i.profile_id) i.profile_id, i.pedido_id
  from business.pedido_item i
  join business.pedido pe on pe.id = i.pedido_id and pe.estado = 'aprobado'
  order by i.profile_id, pe.revisado_at desc nulls last, pe.id desc
) ult
where p.id = ult.profile_id and p.estado in ('vendido', 'en_soporte');
select set_config('playr.liga', '', true);
