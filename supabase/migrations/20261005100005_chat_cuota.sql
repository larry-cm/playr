-- Auditoría de seguridad 2026-10-04: el bucket 'chat' (10 MB por archivo) no tenía tope de subidas: un cliente podía
-- inflar el almacenamiento en bucle, y sin política de borrado los archivos quedan. Tope por cliente en las últimas
-- 24 h: 50 archivos, y como mucho 5 que ningún mensaje usa (subidos y no enviados). El staff no tiene tope.

create function business.chat_puede_subir()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with mios as (
    select o.name
    from storage.objects o
    where o.bucket_id = 'chat'
      and (storage.foldername(o.name))[1] = (select auth.uid())::text
      and o.created_at > now() - interval '1 day'
  )
  select (select count(*) from mios) < 50
     and (select count(*) from mios m
          where not exists (select 1 from business.mensaje_asesor ma where ma.adjunto_path = m.name)) < 5;
$$;

revoke all on function business.chat_puede_subir() from public, anon;
grant execute on function business.chat_puede_subir() to authenticated;

drop policy "chat sube su carpeta o staff" on storage.objects;
create policy "chat sube su carpeta o staff" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat'
    and (business.es_staff()
         or ((storage.foldername(name))[1] = (select auth.uid())::text and business.chat_puede_subir()))
  );
