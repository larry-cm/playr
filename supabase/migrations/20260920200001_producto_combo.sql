-- Los productos se dividen en tres formas de venta: perfiles (una pantalla suelta), cuentas (el login
-- completo de UNA plataforma) y combos (pantallas/cuentas de VARIAS plataformas vendidas juntas).
-- Las dos primeras ya se representaban con access_type pantalla/completa + platform_id; el combo no
-- entraba en ese molde porque no tiene una unica plataforma.
--
-- Cambios:
--   1) access_type gana el valor 'combo': queda como el unico discriminador de la forma del producto.
--   2) producto.platform_id pasa a nullable (un combo no tiene UNA plataforma). No rompe el indice
--      unico parcial producto_platform_access_activo: los NULL no chocan entre si, asi que pueden
--      convivir varios combos activos.
--   3) producto.nombre: como el combo no se puede nombrar por su plataforma, lleva nombre propio
--      ("Combo Familiar"). Los productos simples lo dejan null y se siguen nombrando por plataforma.
--   4) producto_combo_item: la receta del combo (que lleva adentro y cuantas unidades de cada cosa).
--
-- 'combo' se agrega a un enum ya existente. PG 12+ permite hacerlo dentro de una transaccion siempre
-- que el valor nuevo NO se use en la misma transaccion; por eso el check de abajo se escribe listando
-- los valores viejos en vez de "access_type <> 'combo'" (es la misma regla: un combo no anida combos).
alter type business.access_type add value if not exists 'combo';

alter table business.producto
  alter column platform_id drop not null,
  add column nombre text;

-- Todo producto tiene que poder nombrarse: el simple por su plataforma, el combo por su nombre propio.
alter table business.producto
  add constraint producto_identificable check (platform_id is not null or nombre is not null);

create table business.producto_combo_item (
  id bigint generated always as identity primary key,
  producto_id bigint not null references business.producto(id) on delete cascade,
  platform_id bigint not null references business.platform(id),
  access_type business.access_type not null check (access_type in ('completa','pantalla','otro')),
  cantidad int not null default 1 check (cantidad > 0),
  unique (producto_id, platform_id, access_type)
);

-- Mismo baseline que el resto de business.*: sesion logueada, sin distincion de rol todavia.
alter table business.producto_combo_item enable row level security;
create policy "authenticated only" on business.producto_combo_item for all to authenticated using (true) with check (true);

-- catalogo_disponible NO cambia: une producto con account por (platform_id, access_type), y un combo
-- tiene ambos distintos de los de cualquier account, asi que nunca aparece en la Tienda. Mostrar y
-- entregar un combo al cliente exige reservar a la vez un perfil de cada plataforma que lo compone,
-- y eso necesita una tabla de venta/orden que todavia no existe. Queda fuera de este cambio.
