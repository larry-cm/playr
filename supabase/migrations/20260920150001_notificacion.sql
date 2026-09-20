-- business.notificacion: bandeja de avisos IMPORTANTES para admin/manager: fallas y advertencias del scraping
-- (Edge Function stock-price-watch y scraper de licencias de la app) y de la plataforma. No es un log ni el
-- historial de cambios de stock/precio (eso es market_alert): solo lo que requiere atencion humana.
-- "Eliminar" = exist=false (soft-delete, igual que el resto del schema): la fila sigue en la DB, la UI no la muestra.

create type business.origen_notificacion as enum ('scraping', 'plataforma');
create type business.tipo_notificacion as enum ('error', 'advertencia');

create table business.notificacion (
  id bigint generated always as identity primary key,
  origen business.origen_notificacion not null,
  tipo business.tipo_notificacion not null,
  titulo text not null,
  mensaje text not null,
  exist boolean not null default true,
  created_at timestamptz not null default now()
);

-- la bandeja solo lee las visibles, la mas reciente primero; el indice parcial ignora las eliminadas que se acumulan
create index notificacion_visibles on business.notificacion (created_at desc) where exist;

-- A diferencia del baseline del proyecto (authenticated ve todo), aca se restringe por rol: el mensaje de error
-- trae detalle interno (proveedor, rutas, respuestas HTTP) que un cliente (rol 'user') no debe leer.
alter table business.notificacion enable row level security;

create policy "staff lee" on business.notificacion for select to authenticated
  using (exists (
    select 1 from security.user_role ur join security.role r on r.id = ur.role_id
    where ur.auth_user_id = (select auth.uid()) and r.nombre in ('admin', 'manager')
  ));

-- unico UPDATE permitido: descartar (exist=false). No se puede reactivar ni editar el contenido dejandola visible.
create policy "staff descarta" on business.notificacion for update to authenticated
  using (exists (
    select 1 from security.user_role ur join security.role r on r.id = ur.role_id
    where ur.auth_user_id = (select auth.uid()) and r.nombre in ('admin', 'manager')
  ))
  with check (not exist);

-- Nadie inserta ni borra directo: se crea con business.notificar() (o service_role) y "eliminar" nunca es DELETE.
-- Los privilegios por defecto del schema le dan INSERT/DELETE a authenticated; se quitan para no depender solo de RLS.
revoke insert, delete on business.notificacion from authenticated;

-- Punto de entrada para crear avisos: lo llaman la Edge Function (service_role) y los server actions de Next
-- (sesion del usuario, que puede ser un cliente: sin INSERT directo no podria escribir de otra forma).
-- No inserta si ya hay uno IGUAL sin eliminar: una falla persistente con cron cada 6 h no llena la bandeja;
-- si se elimina y la falla sigue, el siguiente intento vuelve a avisar.
-- security definer: debe ver las filas que RLS oculta a los no-staff para poder deduplicar.
-- Confianza = baseline del proyecto (cualquier sesion logueada puede llamarla); anon no.
create function business.notificar(
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
  where not exists (
    select 1 from business.notificacion n
    where n.exist and n.origen = p_origen and n.tipo = p_tipo and n.titulo = p_titulo and n.mensaje = p_mensaje
  )
$$;

revoke all on function business.notificar(business.origen_notificacion, business.tipo_notificacion, text, text) from public;
grant execute on function business.notificar(business.origen_notificacion, business.tipo_notificacion, text, text) to authenticated, service_role;
