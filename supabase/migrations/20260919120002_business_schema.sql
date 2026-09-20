-- business schema: taxonomia compartida (category/platform) + inteligencia de mercado (provider..market_alert)
-- + inventario propio playr (account/profile) + vista catalogo_disponible — ver esquema-db-inventario.canvas

create schema if not exists business;

create table business.category (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  distingue_acceso boolean not null default false
);

create table business.platform (
  id bigint generated always as identity primary key,
  category_id bigint not null references business.category(id),
  nombre text not null unique,
  exist boolean not null default true
);

create table business.provider (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  url text,
  store_path text
);

create table business.provider_account (
  id bigint generated always as identity primary key,
  provider_id bigint not null references business.provider(id),
  nombre_cuenta text not null,
  email text
);

create table business.extraction_run (
  id bigint generated always as identity primary key,
  provider_id bigint not null references business.provider(id),
  provider_account_id bigint not null references business.provider_account(id),
  fecha_extraccion date not null,
  total_productos int not null,
  disponibles int not null,
  agotados int not null
);

create type business.access_type as enum ('completa','pantalla','otro');

create table business.market_listing (
  id bigint generated always as identity primary key,
  provider_id bigint not null references business.provider(id),
  -- nullable: los combos (varios servicios en un producto) no tienen una unica marca
  platform_id bigint references business.platform(id),
  access_type business.access_type not null,
  nombre_raw text not null,
  unique (provider_id, nombre_raw)
);

create table business.market_listing_snapshot (
  id bigint generated always as identity primary key,
  listing_id bigint not null references business.market_listing(id),
  run_id bigint not null references business.extraction_run(id),
  precio numeric(12,2) not null,
  disponible boolean not null,
  unique (listing_id, run_id)
);

create type business.tipo_cambio as enum ('agotado','disponible','precio_cambio');

create table business.market_alert (
  id bigint generated always as identity primary key,
  listing_id bigint not null references business.market_listing(id),
  run_id bigint not null references business.extraction_run(id),
  tipo_cambio business.tipo_cambio not null,
  valor_anterior text,
  valor_nuevo text,
  enviado_at timestamptz not null default now()
);

create table business.account (
  id bigint generated always as identity primary key,
  platform_id bigint not null references business.platform(id),
  sourced_from_listing_id bigint references business.market_listing(id),
  email text not null,
  password_enc text not null,
  perfil_max int not null default 1,
  fecha_vencimiento date,
  costo numeric(12,2),
  exist boolean not null default true,
  created_at timestamptz not null default now()
);

create type business.estado_perfil as enum ('disponible','vendido','suspendido','en_soporte');

create table business.profile (
  id bigint generated always as identity primary key,
  account_id bigint not null references business.account(id),
  nombre_perfil text not null,
  pin text,
  precio_venta numeric(12,2) not null,
  estado business.estado_perfil not null default 'disponible',
  exist boolean not null default true,
  created_at timestamptz not null default now()
);

-- precio_mercado_ref matchea solo por platform_id (account no tiene columna access_type en el diseño
-- original); si despues se necesita matchear tambien por completa/pantalla, agregar esa columna a account.
create view business.catalogo_disponible with (security_invoker = true) as
select
  p.id as profile_id,
  p.nombre_perfil as perfil_nombre,
  p.precio_venta,
  p.estado,
  pl.nombre as platform_nombre,
  c.nombre as categoria,
  (
    select mls.precio
    from business.market_listing_snapshot mls
    join business.market_listing ml on ml.id = mls.listing_id
    where ml.platform_id = pl.id
    order by mls.run_id desc
    limit 1
  ) as precio_mercado_ref
from business.profile p
join business.account a on a.id = p.account_id
join business.platform pl on pl.id = a.platform_id
join business.category c on c.id = pl.category_id
where p.exist and a.exist and p.estado = 'disponible';

-- mismo motivo que en security_schema.sql: baseline minimo (sesion logueada), sin
-- restriccion por rol todavia.
alter table business.category enable row level security;
alter table business.platform enable row level security;
alter table business.provider enable row level security;
alter table business.provider_account enable row level security;
alter table business.extraction_run enable row level security;
alter table business.market_listing enable row level security;
alter table business.market_listing_snapshot enable row level security;
alter table business.market_alert enable row level security;
alter table business.account enable row level security;
alter table business.profile enable row level security;

create policy "authenticated only" on business.category for all to authenticated using (true) with check (true);
create policy "authenticated only" on business.platform for all to authenticated using (true) with check (true);
create policy "authenticated only" on business.provider for all to authenticated using (true) with check (true);
create policy "authenticated only" on business.provider_account for all to authenticated using (true) with check (true);
create policy "authenticated only" on business.extraction_run for all to authenticated using (true) with check (true);
create policy "authenticated only" on business.market_listing for all to authenticated using (true) with check (true);
create policy "authenticated only" on business.market_listing_snapshot for all to authenticated using (true) with check (true);
create policy "authenticated only" on business.market_alert for all to authenticated using (true) with check (true);
create policy "authenticated only" on business.account for all to authenticated using (true) with check (true);
create policy "authenticated only" on business.profile for all to authenticated using (true) with check (true);
