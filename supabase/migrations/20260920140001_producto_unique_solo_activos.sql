-- La unique(platform_id, access_type) original bloqueaba recrear un producto despues de "eliminarlo"
-- (soft-delete: exist=false), porque la fila vieja seguia ocupando la combinacion para siempre.
-- La regla real es: solo puede haber UN producto ACTIVO por plataforma+acceso a la vez.
alter table business.producto drop constraint producto_platform_id_access_type_key;

create unique index producto_platform_access_activo
  on business.producto (platform_id, access_type)
  where exist;
