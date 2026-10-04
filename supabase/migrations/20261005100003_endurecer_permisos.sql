-- Auditoría de seguridad 2026-10-04, puntos leves de la base:
-- 1. Las vistas de la Tienda y del proveedor quedaron con INSERT/UPDATE/DELETE para authenticated (privilegios por
--    defecto al recrearlas). Hoy no son actualizables, pero catalogo_disponible corre con permisos del dueño: si un día
--    se simplifica a una sola tabla, sería una puerta para escribir profile salteando la RLS. Solo lectura.
-- 2. La guarda de perfiles reservados solo miraba `estado`: el staff podía desactivar (exist=false) o mover de cuenta un
--    perfil con un pago por verificar, y el cliente terminaba pagando por un acceso que no se le entrega.
-- 3. Comprobantes: subidas sin límite (costo de almacenamiento). Cada cliente puede subir en un día como mucho 5 archivos que
--    ningún pedido usa; un comprobante que respalda un pedido no cuenta.

revoke insert, update, delete, truncate, references, trigger on business.catalogo_disponible from authenticated, anon;
revoke insert, update, delete, truncate, references, trigger on business.oferta_proveedor from authenticated, anon;

create or replace function business.profile_guarda_reservado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('playr.pedido', true), '') <> 'on'
     and (
       (new.estado is distinct from old.estado and (old.estado = 'reservado' or new.estado = 'reservado'))
       or (old.estado = 'reservado' and (new.exist is distinct from old.exist or new.account_id is distinct from old.account_id))
     ) then
    raise exception 'Este perfil está reservado por un pago por verificar: apruébalo o recházalo en Pedidos.' using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger profile_guarda_reservado on business.profile;
create trigger profile_guarda_reservado before update of estado, exist, account_id on business.profile
  for each row execute function business.profile_guarda_reservado();

-- Archivos del cliente que llama en 'comprobantes' que ningún pedido usa.
create function business.comprobantes_sin_pedido()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from storage.objects o
  where o.bucket_id = 'comprobantes'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text
    and o.created_at > now() - interval '1 day'
    and not exists (select 1 from business.pedido pe where pe.comprobante_path = o.name);
$$;

revoke all on function business.comprobantes_sin_pedido() from public, anon;
grant execute on function business.comprobantes_sin_pedido() to authenticated;

drop policy "comprobantes sube su carpeta" on storage.objects;
create policy "comprobantes sube su carpeta" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and business.comprobantes_sin_pedido() < 5
  );
