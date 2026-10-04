-- La Tienda distingue una cuenta completa de una pantalla: catalogo_disponible expone el tipo de acceso de la cuenta.
-- "create or replace" solo agrega la columna al final: conserva el dueño (security_invoker = false), los permisos y el filtro.
create or replace view business.catalogo_disponible with (security_invoker = false) as
  select
    p.id as profile_id,
    p.nombre_perfil as perfil_nombre,
    pr.precio_venta,
    p.estado,
    pl.nombre as platform_nombre,
    c.nombre as categoria,
    a.access_type
  from business.profile p
    join business.account a on a.id = p.account_id
    join business.platform pl on pl.id = a.platform_id
    join business.category c on c.id = pl.category_id
    join business.producto pr on pr.platform_id = a.platform_id and pr.access_type = a.access_type
  where p.exist and a.exist and p.estado = 'disponible'::business.estado_perfil
    and pr.exist and pr.precio_venta is not null;
