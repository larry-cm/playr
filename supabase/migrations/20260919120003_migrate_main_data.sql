-- migra datos reales existentes de main.client -> security.client
-- y arma security.user_role para cada auth.users ya existente
-- (antes el rol vivia suelto en auth.users.raw_user_meta_data->>'role', sin tabla propia)

-- main.client real tiene filas con email null (ej. clientes soft-deleted incompletos) —
-- el diseño original asumia NOT NULL, la data real no cumple, se ajusta al hecho real.
alter table security.client alter column email drop not null;

-- 8 de 18 filas en main.client son huérfanas (su auth.users fue borrado), las 8 con
-- exist=false — ninguna cuenta activa afectada. Se saltan (quedan intactas en main.client,
-- no se pueden migrar: la FK a auth.users lo exige).
insert into security.client (id, username, email, phone, exist, created_at)
select c.id, c.username, c.email, c.phone, c.exist, c.created_at
from main.client c
where exists (select 1 from auth.users u where u.id = c.id)
on conflict (id) do nothing;

insert into security.user_role (auth_user_id, role_id)
select
  u.id,
  coalesce(
    (select id from security.role where nombre = u.raw_user_meta_data->>'role'),
    (select id from security.role where nombre = 'user')
  )
from auth.users u
on conflict (auth_user_id) do nothing;
