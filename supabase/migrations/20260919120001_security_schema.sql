-- security schema: identidad (auth.users, Supabase) + autorizacion (role/user_role) + perfil de cliente (client)
-- separado del schema business (catalogo/inventario) a proposito — ver esquema-db-seguridad.canvas

create schema if not exists security;

create table security.role (
  id bigint generated always as identity primary key,
  nombre text not null unique check (nombre in ('admin','manager','user'))
);

insert into security.role (nombre) values ('admin'), ('manager'), ('user')
on conflict (nombre) do nothing;

create table security.user_role (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  role_id bigint not null references security.role(id),
  created_at timestamptz not null default now()
);

create table security.client (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  phone text,
  exist boolean not null default true,
  created_at timestamptz not null default now()
);

-- la anon/publishable key viaja al browser (NEXT_PUBLIC_*) y es la unica que usa todo el
-- proyecto (server actions incluidas, ver app/lib/supabase/server.ts) — sin RLS, cualquiera
-- con esa key leeria/escribiria estas tablas directo por PostgREST sin pasar por la app.
-- baseline minimo: exige sesion logueada. Restringir por rol (ej: user no ve otros clientes)
-- es un paso aparte, no incluido aca.
alter table security.role enable row level security;
alter table security.user_role enable row level security;
alter table security.client enable row level security;

create policy "authenticated only" on security.role for all to authenticated using (true) with check (true);
create policy "authenticated only" on security.user_role for all to authenticated using (true) with check (true);
create policy "authenticated only" on security.client for all to authenticated using (true) with check (true);
