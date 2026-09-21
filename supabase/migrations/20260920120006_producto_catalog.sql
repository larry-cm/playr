-- business.producto: catalogo de tipos de producto (platform_id + access_type), con costo/precio_venta
-- configurables por el admin. precio_venta nullable => si no esta seteado, el producto no aparece en
-- catalogo_disponible (visible al cliente). Reemplaza el precio_venta por-slot que vivia en profile.

alter table business.account
  add column access_type business.access_type not null;

create table business.producto (
  id bigint generated always as identity primary key,
  platform_id bigint not null references business.platform(id),
  access_type business.access_type not null,
  costo numeric(12,2),
  precio_venta numeric(12,2),
  exist boolean not null default true,
  created_at timestamptz not null default now(),
  unique (platform_id, access_type)
);

drop view business.catalogo_disponible;

alter table business.profile drop column precio_venta;

create view business.catalogo_disponible with (security_invoker = true) as
select
  p.id as profile_id,
  p.nombre_perfil as perfil_nombre,
  pr.precio_venta,
  p.estado,
  pl.nombre as platform_nombre,
  c.nombre as categoria,
  (
    select mls.precio
    from business.market_listing_snapshot mls
    join business.market_listing ml on ml.id = mls.listing_id
    where ml.platform_id = pl.id and ml.access_type = a.access_type
    order by mls.run_id desc
    limit 1
  ) as precio_mercado_ref
from business.profile p
join business.account a on a.id = p.account_id
join business.platform pl on pl.id = a.platform_id
join business.category c on c.id = pl.category_id
join business.producto pr on pr.platform_id = a.platform_id and pr.access_type = a.access_type
where p.exist and a.exist and p.estado = 'disponible' and pr.exist and pr.precio_venta is not null;

alter table business.producto enable row level security;
create policy "authenticated only" on business.producto for all to authenticated using (true) with check (true);
