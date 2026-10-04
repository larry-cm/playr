-- Pedidos de la Tienda pagados por Bre-B con verificación manual.
--
-- El cliente transfiere a la llave Bre-B del negocio (business.ajuste 'llave_breb'), sube el comprobante al bucket
-- privado 'comprobantes' y crea el pedido con business.crear_pedido: sus perfiles pasan a 'reservado' (salen de la
-- Tienda) hasta que el staff lo revisa, desde el panel o desde los botones del aviso de Telegram (servidor con
-- service_role). Aprobado: los perfiles pasan a 'vendido' y el cliente ve sus accesos. Rechazado: vuelven a 'disponible'.
--
-- Nadie escribe pedido/pedido_item directo: solo las funciones de abajo (security definer). El cliente lee sus pedidos;
-- el staff, todos.

alter type business.estado_perfil add value if not exists 'reservado';

create type business.estado_pedido as enum ('pendiente', 'aprobado', 'rechazado');

create table business.pedido (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references auth.users(id),
  estado business.estado_pedido not null default 'pendiente',
  total numeric(12,2) not null check (total >= 0),
  -- La llave que se le mostró al cliente al pagar: si el admin la cambia después, el pedido conserva a dónde pagó.
  llave_breb text not null,
  -- Ruta en el bucket 'comprobantes': '<cliente_id>/<archivo>'.
  comprobante_path text not null,
  motivo_rechazo text,
  revisado_at timestamptz,
  revisado_by uuid references auth.users(id),
  -- 'panel' o 'telegram:<usuario>': quién lo revisó cuando fue desde Telegram (no hay usuario de la app).
  revisado_via text,
  created_at timestamptz not null default now()
);

create index pedido_cliente on business.pedido (cliente_id, created_at desc);
create index pedido_pendiente on business.pedido (created_at) where estado = 'pendiente';

-- Plataforma, perfil, tipo y precio se copian al crear el pedido: el cliente no puede leer profile/account/producto
-- (RLS solo staff) y el pedido debe mostrar lo que pagó aunque el catálogo cambie.
create table business.pedido_item (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references business.pedido(id),
  profile_id bigint not null references business.profile(id),
  platform_nombre text not null,
  perfil_nombre text not null,
  access_type text not null,
  precio numeric(12,2) not null,
  unique (pedido_id, profile_id)
);

create index pedido_item_pedido on business.pedido_item (pedido_id);
create index pedido_item_profile on business.pedido_item (profile_id);

alter table business.pedido enable row level security;
alter table business.pedido_item enable row level security;

create policy "cliente propio o staff" on business.pedido for select to authenticated
  using (cliente_id = (select auth.uid()) or business.es_staff());
create policy "cliente propio o staff" on business.pedido_item for select to authenticated
  using (exists (
    select 1 from business.pedido pe
    where pe.id = pedido_id and (pe.cliente_id = (select auth.uid()) or business.es_staff())
  ));

revoke all on business.pedido, business.pedido_item from public, anon, authenticated;
grant select on business.pedido, business.pedido_item to authenticated;

-- Comprobantes: bucket privado, imágenes o PDF de hasta 5 MB. Cada cliente sube solo a su carpeta '<uid>/' y lee lo
-- suyo; el staff lee todo. Sin update/delete: el comprobante de un pedido no se cambia.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "comprobantes sube su carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "comprobantes lee propio o staff" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and ((storage.foldername(name))[1] = (select auth.uid())::text or business.es_staff()));

-- Crea el pedido del cliente que llama con los perfiles elegidos. El precio lo pone la base (catalogo_disponible), no
-- el navegador. Falla si algún perfil ya no está disponible (otro cliente lo tomó), si el comprobante no es del
-- cliente o no existe, si no hay llave configurada o si el cliente ya tiene 3 pedidos sin revisar.
create function business.crear_pedido(p_profile_ids bigint[], p_comprobante text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ids bigint[];
  v_llave text;
  v_total numeric(12,2);
  v_disponibles int;
  v_pedido bigint;
begin
  if v_uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_profile_ids) as x where x is not null;
  if coalesce(cardinality(v_ids), 0) = 0 or cardinality(v_ids) > 20 then
    raise exception 'Elige entre 1 y 20 perfiles.' using errcode = '22023';
  end if;

  if p_comprobante is null or split_part(p_comprobante, '/', 1) <> v_uid::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'comprobantes' and o.name = p_comprobante) then
    raise exception 'No encontramos el comprobante. Súbelo de nuevo.' using errcode = '22023';
  end if;

  if (select count(*) from business.pedido pe where pe.cliente_id = v_uid and pe.estado = 'pendiente') >= 3 then
    raise exception 'Ya tienes 3 pagos por verificar. Espera a que los revisemos.' using errcode = 'P0001';
  end if;

  select nullif(trim(a.valor), '') into v_llave from business.ajuste a where a.clave = 'llave_breb';
  if v_llave is null then
    raise exception 'Los pagos por Bre-B no están disponibles en este momento.' using errcode = 'P0001';
  end if;

  -- Bloquea los perfiles: dos clientes que pagan el mismo a la vez no pueden quedarse ambos con él.
  perform 1 from business.profile p where p.id = any (v_ids) for update;

  select count(*), coalesce(sum(c.precio_venta), 0) into v_disponibles, v_total
  from business.catalogo_disponible c where c.profile_id = any (v_ids);
  if v_disponibles <> cardinality(v_ids) then
    raise exception 'Algunos perfiles ya no están disponibles. Actualiza la Tienda y vuelve a elegir.' using errcode = 'P0001';
  end if;

  insert into business.pedido (cliente_id, total, llave_breb, comprobante_path)
  values (v_uid, v_total, v_llave, p_comprobante)
  returning id into v_pedido;

  insert into business.pedido_item (pedido_id, profile_id, platform_nombre, perfil_nombre, access_type, precio)
  select v_pedido, c.profile_id, c.platform_nombre, c.perfil_nombre, c.access_type::text, c.precio_venta
  from business.catalogo_disponible c where c.profile_id = any (v_ids);

  update business.profile p set estado = 'reservado' where p.id = any (v_ids);

  return v_pedido;
end
$$;

-- Staff desde el panel, o el servidor con service_role (botones de Telegram, que ya verificó a quien los tocó).
create function business.puede_revisar_pedido()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select business.es_staff() or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
$$;

-- Aprueba un pedido pendiente: sus perfiles reservados pasan a vendido. Falla si ya fue revisado.
create function business.aprobar_pedido(p_pedido_id bigint, p_via text default 'panel')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado business.estado_pedido;
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select pe.estado into v_estado from business.pedido pe where pe.id = p_pedido_id for update;
  if v_estado is null then
    raise exception 'No existe el pedido.' using errcode = 'P0002';
  end if;
  if v_estado <> 'pendiente' then
    raise exception 'El pedido ya fue revisado.' using errcode = 'P0001';
  end if;

  update business.pedido pe
  set estado = 'aprobado', revisado_at = now(), revisado_by = auth.uid(), revisado_via = left(coalesce(p_via, 'panel'), 80)
  where pe.id = p_pedido_id;

  update business.profile p set estado = 'vendido'
  where p.estado = 'reservado' and p.id in (select i.profile_id from business.pedido_item i where i.pedido_id = p_pedido_id);
end
$$;

-- Rechaza un pedido pendiente: sus perfiles reservados vuelven a la Tienda. Falla si ya fue revisado.
create function business.rechazar_pedido(p_pedido_id bigint, p_motivo text, p_via text default 'panel')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado business.estado_pedido;
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select pe.estado into v_estado from business.pedido pe where pe.id = p_pedido_id for update;
  if v_estado is null then
    raise exception 'No existe el pedido.' using errcode = 'P0002';
  end if;
  if v_estado <> 'pendiente' then
    raise exception 'El pedido ya fue revisado.' using errcode = 'P0001';
  end if;

  update business.pedido pe
  set estado = 'rechazado', motivo_rechazo = left(nullif(trim(p_motivo), ''), 300),
      revisado_at = now(), revisado_by = auth.uid(), revisado_via = left(coalesce(p_via, 'panel'), 80)
  where pe.id = p_pedido_id;

  update business.profile p set estado = 'disponible'
  where p.estado = 'reservado' and p.id in (select i.profile_id from business.pedido_item i where i.pedido_id = p_pedido_id);
end
$$;

revoke all on function business.crear_pedido(bigint[], text) from public, anon;
revoke all on function business.puede_revisar_pedido() from public, anon;
revoke all on function business.aprobar_pedido(bigint, text) from public, anon;
revoke all on function business.rechazar_pedido(bigint, text, text) from public, anon;
grant execute on function business.crear_pedido(bigint[], text) to authenticated;
grant execute on function business.puede_revisar_pedido() to authenticated, service_role;
grant execute on function business.aprobar_pedido(bigint, text) to authenticated, service_role;
grant execute on function business.rechazar_pedido(bigint, text, text) to authenticated, service_role;

-- El cliente ve los accesos de lo que compró: el servidor los resuelve con service_role tras verificar que el pedido es
-- suyo y está aprobado (app/action/tienda/get-accesos-pedido-action.ts). Las funciones de descifrado aceptan ese rol
-- además del staff; para un usuario normal no cambia nada.
create or replace function business.decrypt_account_password(p_account_id bigint, p_enc_key text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enc text;
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select a.password_enc into v_enc from business.account a where a.id = p_account_id and a.exist;
  if v_enc is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(decode(v_enc, 'base64'), p_enc_key);
end
$$;

create or replace function business.decrypt_profile_password(p_profile_id bigint, p_enc_key text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enc text;
begin
  if not business.puede_revisar_pedido() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select p.password_enc into v_enc from business.profile p where p.id = p_profile_id and p.exist;
  if v_enc is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(decode(v_enc, 'base64'), p_enc_key);
end
$$;

grant execute on function business.decrypt_account_password(bigint, text) to service_role;
grant execute on function business.decrypt_profile_password(bigint, text) to service_role;
