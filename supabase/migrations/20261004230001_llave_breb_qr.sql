-- QR de cada llave Bre-B (pedido del usuario 2026-10-04): el admin sube el QR que le genera su app (Nequi,
-- Bancolombia…) y el cliente lo escanea o lo guarda para pagar sin escribir la llave. El QR no es secreto (es para
-- compartirlo), así que el bucket es público: la Tienda lo muestra con su URL pública. Solo el admin sube y borra.

alter table business.llave_breb add column qr_path text
  check (qr_path is null or split_part(qr_path, '/', 1) = id::text);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('llaves-qr', 'llaves-qr', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']);

create policy "llaves-qr admin lee" on storage.objects for select to authenticated
  using (bucket_id = 'llaves-qr' and business.es_admin());
create policy "llaves-qr admin sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'llaves-qr' and business.es_admin());
create policy "llaves-qr admin borra" on storage.objects for delete to authenticated
  using (bucket_id = 'llaves-qr' and business.es_admin());
