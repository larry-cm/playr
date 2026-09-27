-- Verifica las reglas de la migración 20260920200001_producto_combo.sql contra la base real, dentro
-- de una transacción que termina en ROLLBACK: no deja filas ni cambios de esquema.
--   supabase db query --linked -f supabase/checks/producto_combo_check.sql
--
-- El DDL de abajo es idempotente a propósito, así que el check sirve en los dos momentos:
--   * ANTES de aplicar la migración, para probarla sin tocar la base compartida;
--   * DESPUÉS, como verificación de que quedó bien aplicada.
--
-- Una sola prueba depende del momento: PG no deja USAR un valor de enum agregado en la misma
-- transacción, así que "un combo no anida combos" solo puede comprobarse cuando 'combo' ya estaba
-- comprometido (migración aplicada). El check lo detecta solo y avisa cuál de los dos casos corrió.
begin;

create temp table _check_estado on commit drop as
select exists (
  select 1
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'business' and t.typname = 'access_type' and e.enumlabel = 'combo'
) as combo_comprometido;

alter type business.access_type add value if not exists 'combo';

alter table business.producto
  alter column platform_id drop not null,
  add column if not exists nombre text;

alter table business.producto drop constraint if exists producto_identificable;
alter table business.producto
  add constraint producto_identificable check (platform_id is not null or nombre is not null);

create table if not exists business.producto_combo_item (
  id bigint generated always as identity primary key,
  producto_id bigint not null references business.producto(id) on delete cascade,
  platform_id bigint not null references business.platform(id),
  access_type business.access_type not null check (access_type in ('completa','pantalla','otro')),
  cantidad int not null default 1 check (cantidad > 0),
  unique (producto_id, platform_id, access_type)
);

alter table business.producto_combo_item enable row level security;
drop policy if exists "authenticated only" on business.producto_combo_item;
create policy "authenticated only" on business.producto_combo_item for all to authenticated using (true) with check (true);

do $$
declare
  v_producto bigint;
  v_otro bigint;
  v_platform bigint;
  v_platform2 bigint;
  v_comprometido boolean;
begin
  select combo_comprometido into v_comprometido from _check_estado;
  select id into v_platform from business.platform where exist order by id limit 1;
  select id into v_platform2 from business.platform where exist and id <> v_platform order by id limit 1;

  -- 1) un producto sin plataforma pero con nombre (la forma de un combo) ya es válido
  insert into business.producto (platform_id, access_type, nombre, precio_venta)
  values (null, 'otro', 'CHECK combo', 1000) returning id into v_producto;

  -- 2) sin plataforma NI nombre no se puede: todo producto tiene que poder nombrarse
  begin
    insert into business.producto (platform_id, access_type, precio_venta) values (null, 'otro', 1000);
    raise exception 'FALLA: se aceptó un producto sin plataforma ni nombre';
  exception when check_violation then null;
  end;

  -- 3) varios productos sin plataforma conviven: el índice único parcial producto_platform_access_activo
  --    no los hace chocar (NULLs distintos), que es lo que permite tener varios combos activos a la vez
  insert into business.producto (platform_id, access_type, nombre, precio_venta)
  values (null, 'otro', 'CHECK combo 2', 2000) returning id into v_otro;

  -- 4) la receta acepta plataformas distintas, con cantidad
  insert into business.producto_combo_item (producto_id, platform_id, access_type, cantidad)
  values (v_producto, v_platform, 'pantalla', 2), (v_producto, v_platform2, 'pantalla', 1);

  -- 5) pero no repetir el mismo par plataforma+acceso dentro del mismo combo
  begin
    insert into business.producto_combo_item (producto_id, platform_id, access_type)
    values (v_producto, v_platform, 'pantalla');
    raise exception 'FALLA: se aceptó un ítem repetido en el mismo combo';
  exception when unique_violation then null;
  end;

  -- 6) un combo no puede anidar otro combo (solo comprobable con el enum ya comprometido)
  if v_comprometido then
    begin
      insert into business.producto_combo_item (producto_id, platform_id, access_type)
      values (v_producto, v_platform, 'combo');
      raise exception 'FALLA: se aceptó un combo dentro de un combo';
    exception when check_violation then null;
    end;
  end if;

  -- 7) cantidad siempre positiva
  begin
    insert into business.producto_combo_item (producto_id, platform_id, access_type, cantidad)
    values (v_producto, v_platform2, 'completa', 0);
    raise exception 'FALLA: se aceptó una cantidad de 0';
  exception when check_violation then null;
  end;

  -- 8) borrar la cabecera se lleva su receta: create-combo-action lo usa para deshacer un combo que
  --    quedó a medias (cabecera creada, ítems fallidos)
  delete from business.producto where id = v_producto;
  if exists (select 1 from business.producto_combo_item where producto_id = v_producto) then
    raise exception 'FALLA: quedaron ítems huérfanos al borrar el combo';
  end if;

  -- 9) la Tienda no cambia: un combo no tiene account, así que catalogo_disponible no lo muestra
  if exists (select 1 from business.catalogo_disponible cd where cd.perfil_nombre is null) then
    raise exception 'FALLA: catalogo_disponible devolvió filas sin perfil';
  end if;

  delete from business.producto where id = v_otro;

  if v_comprometido then
    raise notice 'OK: producto_combo pasa las 9 comprobaciones (migración ya aplicada)';
  else
    raise notice 'OK: producto_combo pasa 8 de 9 (la 6 necesita la migración aplicada)';
  end if;
end
$$;

rollback;
