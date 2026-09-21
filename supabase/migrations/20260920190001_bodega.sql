-- Modulo Bodega: compras al proveedor (tuproveedor2.com) con el saldo de su monedero, hechas desde la app por admin/manager.
-- Como gasta plata real, la base garantiza tres cosas que la app sola no puede:
--   1) idempotencia: un mismo request_id nunca compra dos veces (reintento de red, doble envio);
--   2) exclusion mutua: solo UNA compra 'iniciada' a la vez, porque el carrito del proveedor es UNO por cuenta (persistente)
--      y dos compras simultaneas mezclarian sus items;
--   3) registro atomico y sin duplicados de lo entregado (business.registrar_licencias): todo o nada, y reintentar no duplica.
-- Nadie escribe compra_proveedor directo: solo las funciones de abajo (security definer, exigen admin/manager).

create type business.estado_compra as enum (
  'iniciada',            -- en curso (pago aun no confirmado)
  'pagada',              -- el proveedor confirmo el pedido; falta registrar la entrega
  'registrada',          -- pagada y la entrega ya esta en el inventario
  'pendiente_registro',  -- pagada, pero parte de la entrega no se pudo registrar (se reintenta desde la app)
  'fallida',             -- fallo ANTES de pagar: no se gasto saldo
  'incierta'             -- no se pudo confirmar si se pago: verificar en el proveedor ANTES de reintentar
);

create table business.compra_proveedor (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  listing_id bigint not null references business.market_listing(id),
  cantidad int not null check (cantidad between 1 and 10),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  total numeric(12,2) not null check (total >= 0),
  estado business.estado_compra not null default 'iniciada',
  pedido_proveedor bigint,           -- numero del pedido en el sitio del proveedor
  saldo_antes numeric(12,2),
  saldo_despues numeric(12,2),
  detalle text,                      -- mensaje para humanos (error o resumen); NUNCA credenciales
  comprador uuid not null,           -- auth.uid() de quien compro
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- (true) = una sola fila 'iniciada' en toda la tabla: es el candado global de compras.
create unique index compra_una_en_curso on business.compra_proveedor ((true)) where estado = 'iniciada';
create index compra_recientes on business.compra_proveedor (created_at desc);

-- admin o manager. Misma regla que las politicas de business.notificacion; como funcion para usarla en varias.
create function business.es_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from security.user_role ur join security.role r on r.id = ur.role_id
    where ur.auth_user_id = (select auth.uid()) and r.nombre in ('admin', 'manager')
  )
$$;

revoke all on function business.es_staff() from public, anon;
grant execute on function business.es_staff() to authenticated;

alter table business.compra_proveedor enable row level security;

create policy "staff lee compras" on business.compra_proveedor for select to authenticated
  using (business.es_staff());

-- Los privilegios por defecto del schema le dan escritura a authenticated; se quitan para que SOLO las funciones escriban.
revoke insert, update, delete on business.compra_proveedor from authenticated;

-- Abre una compra. Devuelve {nueva, compra}: nueva=false significa que ese request_id ya existia (reintento/doble envio) y
-- el llamador NO debe volver a comprar, solo informar el estado guardado.
-- Falla con 'compra_en_curso' si ya hay otra iniciada (candado global). Una 'iniciada' de mas de 5 minutos se da por
-- perdida (proceso caido) y pasa a 'incierta' para no bloquear el modulo para siempre.
create function business.iniciar_compra(
  p_request_id uuid,
  p_listing_id bigint,
  p_cantidad int,
  p_precio_unitario numeric,
  p_saldo numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row business.compra_proveedor;
begin
  if not business.es_staff() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  select * into v_row from business.compra_proveedor where request_id = p_request_id;
  if found then
    return jsonb_build_object('nueva', false, 'compra', to_jsonb(v_row));
  end if;

  update business.compra_proveedor
     set estado = 'incierta', updated_at = now(),
         detalle = 'La compra quedo sin cerrar (se cortó el proceso). Verifica en el proveedor si el pedido se hizo antes de reintentar.'
   where estado = 'iniciada' and created_at < now() - interval '5 minutes';

  begin
    insert into business.compra_proveedor (request_id, listing_id, cantidad, precio_unitario, total, saldo_antes, comprador)
    values (p_request_id, p_listing_id, p_cantidad, p_precio_unitario, round(p_cantidad * p_precio_unitario, 2), p_saldo, (select auth.uid()))
    returning * into v_row;
  exception when unique_violation then
    -- o el request_id se repitio en una carrera, o hay otra compra en curso
    select * into v_row from business.compra_proveedor where request_id = p_request_id;
    if found then
      return jsonb_build_object('nueva', false, 'compra', to_jsonb(v_row));
    end if;
    raise exception 'compra_en_curso' using errcode = 'P0001';
  end;

  return jsonb_build_object('nueva', true, 'compra', to_jsonb(v_row));
end
$$;

-- Mueve una compra por su maquina de estados (transiciones invalidas fallan: nadie puede marcar 'registrada' a mano
-- una compra que no se pago). Los campos opcionales solo se pisan si vienen.
create function business.actualizar_compra(
  p_id bigint,
  p_estado business.estado_compra,
  p_pedido bigint default null,
  p_saldo_despues numeric default null,
  p_detalle text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual business.estado_compra;
begin
  if not business.es_staff() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  select estado into v_actual from business.compra_proveedor where id = p_id for update;
  if not found then
    raise exception 'compra inexistente';
  end if;

  if not (
       (v_actual = 'iniciada' and p_estado in ('pagada', 'fallida', 'incierta'))
    or (v_actual = 'incierta' and p_estado in ('pagada', 'fallida'))
    or (v_actual = 'pagada' and p_estado in ('registrada', 'pendiente_registro'))
    or (v_actual = 'pendiente_registro' and p_estado in ('registrada', 'pendiente_registro'))
  ) then
    raise exception 'transicion invalida: % -> %', v_actual, p_estado;
  end if;

  update business.compra_proveedor
     set estado = p_estado,
         pedido_proveedor = coalesce(p_pedido, pedido_proveedor),
         saldo_despues = coalesce(p_saldo_despues, saldo_despues),
         detalle = coalesce(p_detalle, detalle),
         updated_at = now()
   where id = p_id;
end
$$;

-- Registra licencias entregadas por el proveedor: por cada grupo crea account + profile 'disponible' (clave cifrada con la
-- misma funcion pgcrypto que encrypt_account_password) y garantiza que exista UN producto activo por plataforma+acceso.
--   * Todo o nada: si un grupo falla, ninguno queda registrado (el llamador reintenta sin riesgo).
--   * Sin duplicados: un grupo cuya (plataforma, email, perfil, vencimiento) ya esta registrado se cuenta como 'duplicadas'
--     y se salta; asi reintentar, o crear despues el producto desde Productos, no duplica stock.
--   * El producto que falta se crea SIN precio_venta (o se revive el eliminado, tambien sin precio): no aparece en la
--     Tienda hasta que el manager fije el precio en Productos, y nunca reaparece con un precio viejo.
-- p_grupos: [{platform_id, access_type, listing_id?, email, password, perfil, pin?, vence?('YYYY-MM-DD'), costo?}]
create function business.registrar_licencias(p_grupos jsonb, p_enc_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g jsonb;
  v_platform bigint;
  v_access business.access_type;
  v_account bigint;
  v_vence date;
  v_costo numeric;
  v_reg int := 0;
  v_dup int := 0;
  v_prod int := 0;
begin
  if not business.es_staff() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if p_enc_key is null or length(p_enc_key) < 8 then
    raise exception 'clave de cifrado invalida';
  end if;
  if p_grupos is null or jsonb_typeof(p_grupos) <> 'array' then
    raise exception 'p_grupos debe ser un arreglo';
  end if;

  -- serializa los registros: el chequeo de duplicados de abajo no es atomico entre transacciones concurrentes
  perform pg_advisory_xact_lock(hashtext('business.registrar_licencias'));

  for g in select * from jsonb_array_elements(p_grupos) loop
    v_platform := (g->>'platform_id')::bigint;
    v_access := (g->>'access_type')::business.access_type;
    v_vence := nullif(g->>'vence', '')::date;
    v_costo := nullif(g->>'costo', '')::numeric;

    if coalesce(g->>'email', '') = '' or coalesce(g->>'password', '') = '' or coalesce(g->>'perfil', '') = '' then
      raise exception 'grupo incompleto: faltan email, password o perfil';
    end if;
    if not exists (select 1 from business.platform where id = v_platform and exist) then
      raise exception 'plataforma % inexistente', v_platform;
    end if;

    if exists (
      select 1 from business.account a join business.profile p on p.account_id = a.id
      where a.exist and p.exist and a.platform_id = v_platform
        and lower(a.email) = lower(g->>'email') and p.nombre_perfil = g->>'perfil'
        and a.fecha_vencimiento is not distinct from v_vence
    ) then
      v_dup := v_dup + 1;
      continue;
    end if;

    insert into business.account (platform_id, access_type, sourced_from_listing_id, email, password_enc, perfil_max, fecha_vencimiento, costo)
    values (v_platform, v_access, nullif(g->>'listing_id', '')::bigint, g->>'email',
            encode(extensions.pgp_sym_encrypt(g->>'password', p_enc_key), 'base64'),
            1, v_vence, v_costo)
    returning id into v_account;

    insert into business.profile (account_id, nombre_perfil, pin, estado)
    values (v_account, g->>'perfil', nullif(g->>'pin', ''), 'disponible');
    v_reg := v_reg + 1;

    if not exists (select 1 from business.producto where platform_id = v_platform and access_type = v_access and exist) then
      -- el costo de referencia sale de la oferta vigente del proveedor (igual que "Agregar producto"); puede no haber
      select o.costo into v_costo from business.oferta_proveedor o where o.platform_id = v_platform and o.access_type = v_access;

      update business.producto
         set exist = true, costo = v_costo, precio_venta = null
       where id = (select id from business.producto where platform_id = v_platform and access_type = v_access and not exist order by id desc limit 1);
      if not found then
        insert into business.producto (platform_id, access_type, costo, precio_venta) values (v_platform, v_access, v_costo, null);
      end if;
      v_prod := v_prod + 1;
    end if;
  end loop;

  return jsonb_build_object('registradas', v_reg, 'duplicadas', v_dup, 'productos_creados', v_prod);
end
$$;

revoke all on function business.iniciar_compra(uuid, bigint, int, numeric, numeric) from public, anon;
revoke all on function business.actualizar_compra(bigint, business.estado_compra, bigint, numeric, text) from public, anon;
revoke all on function business.registrar_licencias(jsonb, text) from public, anon;
grant execute on function business.iniciar_compra(uuid, bigint, int, numeric, numeric) to authenticated;
grant execute on function business.actualizar_compra(bigint, business.estado_compra, bigint, numeric, text) to authenticated;
grant execute on function business.registrar_licencias(jsonb, text) to authenticated;
