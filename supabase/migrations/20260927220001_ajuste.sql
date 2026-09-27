-- Ajustes de la app editables por el admin sin redesplegar (clave/valor). Primer uso: 'whatsapp_asesor', el numero
-- del asesor al que Soporte y la Tienda mandan los mensajes (antes solo la variable NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER,
-- que sigue como respaldo si falta la fila).
--
-- IMPORTANTE: esta tabla solo guarda ajustes PUBLICOS. Cualquier sesion logueada (incluidos clientes con rol user)
-- lee todas sus filas, porque el cliente necesita el numero en Soporte y en la Tienda. Nunca guardar aca claves,
-- tokens ni nada que un cliente no deba ver: eso va en Vault o en variables del servidor.

create table business.ajuste (
  clave text primary key check (clave ~ '^[a-z][a-z0-9_]*$'),
  valor text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table business.ajuste is
  'Ajustes PUBLICOS de la app (clave/valor): los lee cualquier usuario logueado. Solo el admin escribe. No guardar secretos.';

-- Solo admin (es_staff() tambien deja pasar a manager). Misma forma que es_staff: security definer con search_path fijo,
-- lee security.user_role (que el usuario no puede escribir).
create function business.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from security.user_role ur join security.role r on r.id = ur.role_id
    where ur.auth_user_id = (select auth.uid()) and r.nombre = 'admin'
  )
$$;

revoke all on function business.es_admin() from public, anon;
grant execute on function business.es_admin() to authenticated;

-- Quien y cuando lo cambio lo pone la base, no lo que mande el cliente.
create function business.ajuste_sello()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end
$$;

revoke all on function business.ajuste_sello() from public, anon, authenticated;

create trigger ajuste_sello before insert or update on business.ajuste
  for each row execute function business.ajuste_sello();

alter table business.ajuste enable row level security;

create policy "lee logueado" on business.ajuste for select to authenticated using (true);
create policy "admin crea" on business.ajuste for insert to authenticated with check (business.es_admin());
create policy "admin edita" on business.ajuste for update to authenticated
  using (business.es_admin()) with check (business.es_admin());

-- Sin DELETE para nadie desde la API (la app sin fila cae al valor de la variable de entorno); anon no ve nada.
revoke all on business.ajuste from public, anon, authenticated;
grant select, insert, update on business.ajuste to authenticated;
