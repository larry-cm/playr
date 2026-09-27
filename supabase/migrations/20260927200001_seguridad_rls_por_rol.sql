-- Auditoria de seguridad 2026-09-27: el baseline "authenticated only" (using true / with check true)
-- dejaba a cualquier sesion logueada (incluidos clientes con rol user) escribir security.user_role
-- (= hacerse admin), leer PINs/correos/claves cifradas y costos del proveedor, y editar inventario y precios.
-- Desde aca: todo business.* y security.* es solo staff (business.es_staff(), que lee security.user_role
-- con security definer), salvo lo que el cliente necesita: su propia fila de rol/cliente y la Tienda
-- (catalogo_disponible). Los roles solo se asignan desde el servidor con la clave secreta (service_role,
-- ignora RLS) y despues de verificar que quien llama es admin.

-- ---------- security ----------
drop policy "authenticated only" on security.role;
drop policy "authenticated only" on security.user_role;
drop policy "authenticated only" on security.client;

-- nombres de rol: lectura para cualquiera logueado, escritura de nadie (solo migraciones).
create policy "lee roles" on security.role for select to authenticated using (true);

-- cada uno ve su propio rol (getRoleUser); staff ve todos. Sin INSERT/UPDATE/DELETE para authenticated.
create policy "lee rol propio o staff" on security.user_role for select to authenticated
  using (auth_user_id = (select auth.uid()) or business.es_staff());

-- clientes: cada uno ve su fila; staff lee, edita y da de baja. Alta = servidor con service_role.
create policy "lee cliente propio o staff" on security.client for select to authenticated
  using (id = (select auth.uid()) or business.es_staff());
create policy "staff edita clientes" on security.client for update to authenticated
  using (business.es_staff()) with check (business.es_staff());

-- no depender solo de RLS: sin politica ya no pueden, pero se quitan los privilegios igual.
revoke insert, update, delete on security.role, security.user_role from authenticated, anon;
revoke insert, delete on security.client from authenticated, anon;
revoke all on security.role, security.user_role, security.client from anon;

-- ---------- business: inventario propio (staff lee y escribe) ----------
drop policy "authenticated only" on business.account;
drop policy "authenticated only" on business.profile;
drop policy "authenticated only" on business.producto;
drop policy "authenticated only" on business.producto_combo_item;

create policy "staff" on business.account for all to authenticated
  using (business.es_staff()) with check (business.es_staff());
create policy "staff" on business.profile for all to authenticated
  using (business.es_staff()) with check (business.es_staff());
create policy "staff" on business.producto for all to authenticated
  using (business.es_staff()) with check (business.es_staff());
create policy "staff" on business.producto_combo_item for all to authenticated
  using (business.es_staff()) with check (business.es_staff());

-- ---------- business: datos del proveedor y del mercado (staff solo lee) ----------
-- Los escribe la Edge Function stock-price-watch con service_role (ignora RLS). Nadie desde la app:
-- si un cliente pudiera renombrar un market_listing, podria desviar lo que compra un manager en Bodega.
drop policy "authenticated only" on business.category;
drop policy "authenticated only" on business.platform;
drop policy "authenticated only" on business.provider;
drop policy "authenticated only" on business.provider_account;
drop policy "authenticated only" on business.extraction_run;
drop policy "authenticated only" on business.market_listing;
drop policy "authenticated only" on business.market_listing_snapshot;
drop policy "authenticated only" on business.market_alert;

create policy "staff lee" on business.category for select to authenticated using (business.es_staff());
create policy "staff lee" on business.platform for select to authenticated using (business.es_staff());
create policy "staff lee" on business.provider for select to authenticated using (business.es_staff());
create policy "staff lee" on business.provider_account for select to authenticated using (business.es_staff());
create policy "staff lee" on business.extraction_run for select to authenticated using (business.es_staff());
create policy "staff lee" on business.market_listing for select to authenticated using (business.es_staff());
create policy "staff lee" on business.market_listing_snapshot for select to authenticated using (business.es_staff());
create policy "staff lee" on business.market_alert for select to authenticated using (business.es_staff());

revoke insert, update, delete on
  business.category, business.platform, business.provider, business.provider_account,
  business.extraction_run, business.market_listing, business.market_listing_snapshot, business.market_alert
  from authenticated;

revoke all on all tables in schema business from anon;

-- ---------- Tienda ----------
-- El cliente ya no puede leer profile/account/producto, asi que la vista corre con los permisos del dueño
-- (security_invoker = false) y expone solo lo que la Tienda muestra. Se quita precio_mercado_ref: era el
-- costo del proveedor (la app no lo usa) y no debe verlo un cliente.
drop view business.catalogo_disponible;
create view business.catalogo_disponible with (security_invoker = false) as
  select
    p.id as profile_id,
    p.nombre_perfil as perfil_nombre,
    pr.precio_venta,
    p.estado,
    pl.nombre as platform_nombre,
    c.nombre as categoria
  from business.profile p
    join business.account a on a.id = p.account_id
    join business.platform pl on pl.id = a.platform_id
    join business.category c on c.id = pl.category_id
    join business.producto pr on pr.platform_id = a.platform_id and pr.access_type = a.access_type
  where p.exist and a.exist and p.estado = 'disponible'::business.estado_perfil
    and pr.exist and pr.precio_venta is not null;

revoke all on business.catalogo_disponible from public, anon;
grant select on business.catalogo_disponible to authenticated;

-- ---------- notificar ----------
-- Antes cualquier sesion podia meter avisos arbitrarios en la campana del staff. Ahora: staff o service_role
-- (Edge Function y server de Next con la clave secreta). Para el resto no inserta nada (no lanza error:
-- avisar nunca debe romper el flujo que avisa).
create or replace function business.notificar(
  p_origen business.origen_notificacion,
  p_tipo business.tipo_notificacion,
  p_titulo text,
  p_mensaje text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into business.notificacion (origen, tipo, titulo, mensaje)
  select p_origen, p_tipo, p_titulo, p_mensaje
  where (auth.role() = 'service_role' or business.es_staff())
    and not exists (
      select 1 from business.notificacion n
      where n.exist and n.origen = p_origen and n.tipo = p_tipo and n.titulo = p_titulo and n.mensaje = p_mensaje
    )
$$;

-- ---------- main (esquema viejo, previo a business/security) ----------
-- Ya no lo usa la app. Se conserva (sin borrar datos) pero queda cerrado: sin trigger sobre auth.users,
-- sin privilegios para anon/authenticated. Tambien se saca de los schemas expuestos por la API (config
-- del proyecto, fuera de SQL).
drop trigger if exists on_auth_user_created on auth.users;
revoke all on all tables in schema main from anon, authenticated;
revoke all on all functions in schema main from anon, authenticated, public;
revoke usage on schema main from anon, authenticated;
alter function main.trg_limit_profiles_per_account() set search_path = '';
