-- Hora del escaneo: business.extraction_run solo guardaba fecha_extraccion (date) y Bodega no podia mostrar a que hora el cron
-- vio el stock y los precios del proveedor.
-- Se agrega la columna SIN default y despues se le pone now(): asi las corridas que ya existen quedan en NULL (no se sabe su hora
-- y la UI muestra solo la fecha, no una hora inventada) y las nuevas toman la hora del insert. Queda nullable por esas filas viejas.
-- La Edge Function stock-price-watch no cambia: el default llena la columna.
alter table business.extraction_run add column if not exists created_at timestamptz;
alter table business.extraction_run alter column created_at set default now();

comment on column business.extraction_run.created_at is
  'Momento del escaneo (insert de la corrida). NULL en las corridas anteriores a 20260927210001: de esas solo se sabe fecha_extraccion.';
