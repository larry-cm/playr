-- Seed real: tuproveedor2.com, extracción 2026-09-19
-- Fuente: Bobeda de Larry/Informe de productos/inventario-tienda-tuproveedor2.md
-- (mismo contenido que supabase/seed.sql — copiado acá como migración porque
-- `db push --include-seed` remoto necesita supabase/config.toml, que este proyecto
-- todavía no tiene; seed.sql se deja igual por si más adelante se usa `db reset` local)
begin;

insert into business.category (nombre, distingue_acceso) values
  ('Streaming de video', true),
  ('IPTV / TV en vivo', true),
  ('Música', false),
  ('Productividad / Educación', false),
  ('Combos', false)
on conflict (nombre) do nothing;

insert into business.platform (category_id, nombre, exist) values
  ((select id from business.category where nombre = 'Streaming de video'), 'AMAZON', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'CRUNCHYROLL', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'DISNEY', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'HBO', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'MAX', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'PARAMOUNT', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'PLEX', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'TELELATINO', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'UNIVERSAL+', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'VIX+', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'APPLE TV', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'NETFLIX', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'CLARO VIDEO', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'PORNHUB', true),
  ((select id from business.category where nombre = 'Streaming de video'), 'YOUTUBE', true),
  ((select id from business.category where nombre = 'IPTV / TV en vivo'), 'IPTV', true),
  ((select id from business.category where nombre = 'IPTV / TV en vivo'), 'FLUJO TV', true),
  ((select id from business.category where nombre = 'IPTV / TV en vivo'), 'CAP CUP', true),
  ((select id from business.category where nombre = 'IPTV / TV en vivo'), 'FLUJO PANEL', true),
  ((select id from business.category where nombre = 'IPTV / TV en vivo'), 'DIRECTV GO', true),
  ((select id from business.category where nombre = 'Música'), 'DEEZER', true),
  ((select id from business.category where nombre = 'Música'), 'SPOTIFY', true),
  ((select id from business.category where nombre = 'Productividad / Educación'), 'CANVA', true),
  ((select id from business.category where nombre = 'Productividad / Educación'), 'DUOLINGO', true),
  ((select id from business.category where nombre = 'Productividad / Educación'), 'OFFICE', true)
on conflict (nombre) do nothing;

insert into business.provider (nombre, url, store_path) values
  ('tuproveedor2.com', 'https://tuproveedor2.com', '/tienda')
on conflict (nombre) do nothing;

insert into business.provider_account (provider_id, nombre_cuenta, email)
select (select id from business.provider where nombre = 'tuproveedor2.com'), 'Moncada Store', null
where not exists (select 1 from business.provider_account where nombre_cuenta = 'Moncada Store');

insert into business.extraction_run (provider_id, provider_account_id, fecha_extraccion, total_productos, disponibles, agotados)
select
  (select id from business.provider where nombre = 'tuproveedor2.com'),
  (select id from business.provider_account where nombre_cuenta = 'Moncada Store'),
  date '2026-09-19', 65, 63, 2
where not exists (select 1 from business.extraction_run where fecha_extraccion = date '2026-09-19');

-- market_listing: 65 productos (63 vigentes + 2 agotados), platform NULL para combos
with p as (
  select id as provider_id from business.provider where nombre = 'tuproveedor2.com'
)
insert into business.market_listing (provider_id, platform_id, access_type, nombre_raw)
select p.provider_id, plat.id, v.access_type::business.access_type, v.nombre_raw
from p
cross join (values
  ('completa', 'AMAZON ORIGINAL COMPLETA', 'AMAZON'),
  ('completa', 'AMAZON PRIME COMPLETA 1 MES', 'AMAZON'),
  ('completa', 'CRUNCHYROLL COMPLETA', 'CRUNCHYROLL'),
  ('completa', 'DISNEY ESTANDAR COMPLETA RENOVABLE', 'DISNEY'),
  ('completa', 'HBO COMPLETA', 'HBO'),
  ('completa', 'MAX ESTANDAR ORIGINAL COMPLETA', 'MAX'),
  ('completa', 'MAX PLATINO COMPLETA RENOVABLE', 'MAX'),
  ('completa', 'PARAMOUNT COMPLETA', 'PARAMOUNT'),
  ('completa', 'PLEX COMPLETA', 'PLEX'),
  ('completa', 'TELELATINO PREMIUM COMPLETA', 'TELELATINO'),
  ('completa', 'UNIVERSAL+ COMPLETA', 'UNIVERSAL+'),
  ('completa', 'VIX+ COMPLETA', 'VIX+'),
  ('pantalla', 'AMAZON ORIGINAL PANTALLA', 'AMAZON'),
  ('pantalla', 'AMAZON PRIME PANTALLA 1 MES', 'AMAZON'),
  ('pantalla', 'APPLE TV PANTALLA 1 MES', 'APPLE TV'),
  ('pantalla', 'APPLE TV PANTALLA 3 MESES', 'APPLE TV'),
  ('pantalla', 'CRUNCHYROLL PANTALLA', 'CRUNCHYROLL'),
  ('pantalla', 'DISNEY ESTANDAR PANTALLA RENOVABLE', 'DISNEY'),
  ('pantalla', 'DISNEY GENÉRICA PANTALLA', 'DISNEY'),
  ('pantalla', 'DISNEY PREMIUM PANTALLA 1 MES', 'DISNEY'),
  ('pantalla', 'DISNEY PREMIUN ORIGINAL 7 ESPN PANTALLA', 'DISNEY'),
  ('pantalla', 'HBO PANTALLA', 'HBO'),
  ('pantalla', 'MAX ESTANDAR ORIGINAL PANTALLA', 'MAX'),
  ('pantalla', 'MAX PLATINO PANTALLA RENOVABLE', 'MAX'),
  ('pantalla', 'NETFLIX ORIGINAL PANTALLA 27 DIAS RENOVABLE', 'NETFLIX'),
  ('pantalla', 'NETFLIX ORIGINAL PANTALLA 33 DIAS RENOVABLE', 'NETFLIX'),
  ('pantalla', 'PARAMOUNT PANTALLA', 'PARAMOUNT'),
  ('pantalla', 'PLEX PANTALLA (premium)', 'PLEX'),
  ('pantalla', 'TELELATINO PREMIUM PANTALLA', 'TELELATINO'),
  ('pantalla', 'VIX+ PANTALLA', 'VIX+'),
  ('otro', 'CLARO VIDEO CON WIN + (TODOS LOS DISPOSITIVOS)', 'CLARO VIDEO'),
  ('otro', 'PORHUB 1 MES', 'PORNHUB'),
  ('otro', 'YOUTUBE 1 MES FULL', 'YOUTUBE'),
  ('completa', 'IPTV COMPLETA 12 MESES', 'IPTV'),
  ('completa', 'IPTV COMPLETA 3 DISPOSITIVOS', 'IPTV'),
  ('completa', 'IPTV COMPLETA 6 MESES', 'IPTV'),
  ('completa', 'FLUJO TV (COMPLETA 3 DISPOSITIVOS)', 'FLUJO TV'),
  ('pantalla', 'ORIGINAL IPTV PANTALLA', 'IPTV'),
  ('otro', 'CAP CUP 2 DISPOSITIVO ( SI AGREGRAN MAS DE 2 DISPOSITIVO PIERDEN GARANTIAS )', 'CAP CUP'),
  ('otro', 'FLUJO TV (1DISPO)', 'FLUJO TV'),
  ('otro', 'FLUJO TV 1 AÑO', 'FLUJO TV'),
  ('otro', 'FLUJO TV 3 MESES', 'FLUJO TV'),
  ('otro', 'FLUJO TV X6 MESES', 'FLUJO TV'),
  ('otro', 'FLUJO PANEL 30 CREDITOS', 'FLUJO PANEL'),
  ('otro', 'DEEZER PREMIUM X1 MES', 'DEEZER'),
  ('otro', 'DEEZER PREMIUM X2 MESES', 'DEEZER'),
  ('otro', 'SPOTIFY 1 MES', 'SPOTIFY'),
  ('otro', 'SPOTIFY 3 MESES', 'SPOTIFY'),
  ('otro', 'CANVA PRO 1 MES CON CORREO DEL CLIENTE', 'CANVA'),
  ('otro', 'CANVA PRO 12 MESES CON CORREO DEL CLIENTE', 'CANVA'),
  ('otro', 'CANVA PRO 3 MESES CON CORREO DEL CLIENTE', 'CANVA'),
  ('otro', 'CANVA PRO ORIGINAL 1 MES RENOVABLE', 'CANVA'),
  ('otro', 'DUOLINGO 1 MES', 'DUOLINGO'),
  ('otro', 'PAQUETE OFFICE 1 AÑO', 'OFFICE'),
  ('otro', 'COMBO AMAZON + CRUNCHYRROLL', null),
  ('otro', 'COMBO AMAZON + DISNEY', null),
  ('otro', 'COMBO AMAZON + HBO', null),
  ('otro', 'COMBO HBO + CRUNCHYRROLL', null),
  ('otro', 'COMBO HBO + DISNEY PREMIUM', null),
  ('otro', 'COMBO NETFLIX + AMAZON', null),
  ('otro', 'COMBO NETFLIX + CRUNCHYRROLL', null),
  ('otro', 'COMBO NETFLIX + DISNEY PREMIUM', null),
  ('otro', 'COMBO NETFLIX + HBO PLATINO', null),
  ('pantalla', 'DIRECTV GO GOLD CON WIN + PANTALLA RENOVABLE 1 DISP + PANTALLA DE AMAZON DE REGALO (todos los partidos del mundial)', 'DIRECTV GO'),
  ('otro', 'DIRECTV GO PLAN ORO', 'DIRECTV GO')
) as v(access_type, nombre_raw, platform_nombre)
left join business.platform plat on plat.nombre = v.platform_nombre
on conflict (provider_id, nombre_raw) do nothing;

-- market_listing_snapshot: 1 fila por listing en la corrida 2026-09-19 (63 disponibles, 2 agotados)
with p as (
  select id as provider_id from business.provider where nombre = 'tuproveedor2.com'
),
r as (
  select id as run_id from business.extraction_run where fecha_extraccion = date '2026-09-19'
)
insert into business.market_listing_snapshot (listing_id, run_id, precio, disponible)
select ml.id, r.run_id, v.precio, v.disponible
from p, r
cross join (values
  ('AMAZON ORIGINAL COMPLETA', 9000.00, true),
  ('AMAZON PRIME COMPLETA 1 MES', 6500.00, true),
  ('CRUNCHYROLL COMPLETA', 9000.00, true),
  ('DISNEY ESTANDAR COMPLETA RENOVABLE', 7500.00, true),
  ('HBO COMPLETA', 5000.00, true),
  ('MAX ESTANDAR ORIGINAL COMPLETA', 10000.00, true),
  ('MAX PLATINO COMPLETA RENOVABLE', 9000.00, true),
  ('PARAMOUNT COMPLETA', 13000.00, true),
  ('PLEX COMPLETA', 7800.00, true),
  ('TELELATINO PREMIUM COMPLETA', 11000.00, true),
  ('UNIVERSAL+ COMPLETA', 11500.00, true),
  ('VIX+ COMPLETA', 5000.00, true),
  ('AMAZON ORIGINAL PANTALLA', 2700.00, true),
  ('AMAZON PRIME PANTALLA 1 MES', 1500.00, true),
  ('APPLE TV PANTALLA 1 MES', 3500.00, true),
  ('APPLE TV PANTALLA 3 MESES', 7500.00, true),
  ('CRUNCHYROLL PANTALLA', 2500.00, true),
  ('DISNEY ESTANDAR PANTALLA RENOVABLE', 1800.00, true),
  ('DISNEY GENÉRICA PANTALLA', 1200.00, true),
  ('DISNEY PREMIUM PANTALLA 1 MES', 3800.00, true),
  ('DISNEY PREMIUN ORIGINAL 7 ESPN PANTALLA', 5000.00, true),
  ('HBO PANTALLA', 1500.00, true),
  ('MAX ESTANDAR ORIGINAL PANTALLA', 3500.00, true),
  ('MAX PLATINO PANTALLA RENOVABLE', 2200.00, true),
  ('NETFLIX ORIGINAL PANTALLA 27 DIAS RENOVABLE', 8600.00, true),
  ('NETFLIX ORIGINAL PANTALLA 33 DIAS RENOVABLE', 10700.00, true),
  ('PARAMOUNT PANTALLA', 3000.00, true),
  ('PLEX PANTALLA (premium)', 3900.00, true),
  ('TELELATINO PREMIUM PANTALLA', 4500.00, true),
  ('VIX+ PANTALLA', 2400.00, true),
  ('CLARO VIDEO CON WIN + (TODOS LOS DISPOSITIVOS)', 23000.00, true),
  ('PORHUB 1 MES', 5000.00, true),
  ('YOUTUBE 1 MES FULL', 6500.00, true),
  ('IPTV COMPLETA 12 MESES', 47000.00, true),
  ('IPTV COMPLETA 3 DISPOSITIVOS', 8000.00, true),
  ('IPTV COMPLETA 6 MESES', 24000.00, true),
  ('FLUJO TV (COMPLETA 3 DISPOSITIVOS)', 11500.00, true),
  ('ORIGINAL IPTV PANTALLA', 5000.00, true),
  ('CAP CUP 2 DISPOSITIVO ( SI AGREGRAN MAS DE 2 DISPOSITIVO PIERDEN GARANTIAS )', 24000.00, true),
  ('FLUJO TV (1DISPO)', 5000.00, true),
  ('FLUJO TV 1 AÑO', 125000.00, true),
  ('FLUJO TV 3 MESES', 32500.00, true),
  ('FLUJO TV X6 MESES', 62000.00, true),
  ('FLUJO PANEL 30 CREDITOS', 325000.00, true),
  ('DEEZER PREMIUM X1 MES', 3500.00, true),
  ('DEEZER PREMIUM X2 MESES', 5500.00, true),
  ('SPOTIFY 1 MES', 6500.00, true),
  ('SPOTIFY 3 MESES', 13900.00, true),
  ('CANVA PRO 1 MES CON CORREO DEL CLIENTE', 2500.00, true),
  ('CANVA PRO 12 MESES CON CORREO DEL CLIENTE', 12000.00, true),
  ('CANVA PRO 3 MESES CON CORREO DEL CLIENTE', 6000.00, true),
  ('CANVA PRO ORIGINAL 1 MES RENOVABLE', 3000.00, true),
  ('DUOLINGO 1 MES', 4000.00, true),
  ('PAQUETE OFFICE 1 AÑO', 13000.00, true),
  ('COMBO AMAZON + CRUNCHYRROLL', 3000.00, true),
  ('COMBO AMAZON + DISNEY', 6000.00, true),
  ('COMBO AMAZON + HBO', 4000.00, true),
  ('COMBO HBO + CRUNCHYRROLL', 3500.00, true),
  ('COMBO HBO + DISNEY PREMIUM', 6500.00, true),
  ('COMBO NETFLIX + AMAZON', 9800.00, true),
  ('COMBO NETFLIX + CRUNCHYRROLL', 9500.00, true),
  ('COMBO NETFLIX + DISNEY PREMIUM', 13000.00, true),
  ('COMBO NETFLIX + HBO PLATINO', 9800.00, true),
  ('DIRECTV GO GOLD CON WIN + PANTALLA RENOVABLE 1 DISP + PANTALLA DE AMAZON DE REGALO (todos los partidos del mundial)', 18900.00, false),
  ('DIRECTV GO PLAN ORO', 13500.00, false)
) as v(nombre_raw, precio, disponible)
join business.market_listing ml on ml.nombre_raw = v.nombre_raw
where ml.provider_id = p.provider_id
on conflict (listing_id, run_id) do nothing;

commit;
