-- Registro de compras de Bodega guardado en la base. Antes se leia del sitio del proveedor en cada visita (login en frio +
-- hasta 20 paginas de /mi-cuenta/orders/ + "Mis licencias"): lento. Ahora la pagina lee esta fila (rapido) y el sitio solo se
-- consulta para sincronizar (una vez al dia, en segundo plano, o con el boton "Sincronizar").
--   * Una fila por CUENTA del proveedor: cuenta = sha256 hex de host + '|' + lower(email). Si cambia la cuenta configurada,
--     arranca su propio registro (los pedidos de otra cuenta no se mezclan).
--   * pedidos = arreglo jsonb ya formateado (PedidoProveedor[] de app/lib/bodega/tipos.ts + origen), del mas nuevo al mas
--     viejo. Postgres lo comprime solo (TOAST) cuando crece.
--   * Nadie escribe la tabla directo: solo business.historial_fusionar (security definer, exige admin/manager), que fusiona
--     bajo candado de fila, asi una compra que agrega su pedido y una sincronizacion simultanea no se pisan.

create table business.historial_proveedor (
  cuenta text primary key check (cuenta ~ '^[0-9a-f]{64}$'),
  host text not null,
  pedidos jsonb not null default '[]'::jsonb check (jsonb_typeof(pedidos) = 'array'),
  sincronizado_en timestamptz,                         -- ultima lectura completa del sitio; null = nunca
  actualizado_en timestamptz not null default now()
);

comment on table business.historial_proveedor is
  'Registro de compras de Bodega por cuenta del proveedor (cache del sitio). Solo staff lee; solo business.historial_fusionar escribe.';

alter table business.historial_proveedor enable row level security;

create policy "staff lee" on business.historial_proveedor for select to authenticated
  using (business.es_staff());

-- Los privilegios por defecto del schema le dan escritura a authenticated; se quitan para que SOLO la funcion escriba.
revoke all on business.historial_proveedor from public, anon, authenticated;
grant select on business.historial_proveedor to authenticated;

-- Fusiona p_pedidos con lo guardado de esa cuenta (crea la fila si no existe) y devuelve {pedidos, sincronizado_en}.
--   * Union por id: lo que llega gana (el sitio es la verdad; y una sincronizacion corrige el pedido que agrego la compra).
--     Los pedidos guardados que no vienen se conservan (la lectura del sitio se corta en 20 paginas).
--   * origen se recalcula en cada fusion: 'plataforma' si el pedido es de una compra hecha desde Bodega
--     (compra_proveedor.pedido_proveedor), si no 'proveedor' (hecho a mano en el sitio).
--   * Orden: fecha desc, id desc.
--   * p_sincronizado = true solo cuando p_pedidos es la lectura completa del sitio: entonces se sella sincronizado_en.
create function business.historial_fusionar(p_cuenta text, p_host text, p_pedidos jsonb, p_sincronizado boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row business.historial_proveedor;
  v_pedidos jsonb;
begin
  if not business.es_staff() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if p_pedidos is null or jsonb_typeof(p_pedidos) <> 'array' then
    raise exception 'p_pedidos debe ser un arreglo';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_pedidos) e
    where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'id') is distinct from 'number' or jsonb_typeof(e->'fecha') is distinct from 'string'
  ) then
    raise exception 'cada pedido debe traer id (numero) y fecha (texto)';
  end if;

  insert into business.historial_proveedor (cuenta, host) values (p_cuenta, p_host) on conflict (cuenta) do nothing;
  select * into v_row from business.historial_proveedor where cuenta = p_cuenta for update;

  select coalesce(jsonb_agg(s.p order by (s.p->>'fecha')::timestamptz desc, (s.p->>'id')::bigint desc), '[]'::jsonb)
    into v_pedidos
    from (
      select distinct on ((x.e->>'id')::bigint)
             (x.e - 'origen') || jsonb_build_object('origen',
               case when exists (select 1 from business.compra_proveedor c where c.pedido_proveedor = (x.e->>'id')::bigint)
                    then 'plataforma' else 'proveedor' end) as p
        from (
          select e, 1 as prioridad from jsonb_array_elements(p_pedidos) e
          union all
          select e, 2 from jsonb_array_elements(v_row.pedidos) e
        ) x
       order by (x.e->>'id')::bigint, x.prioridad
    ) s;

  update business.historial_proveedor
     set host = p_host,
         pedidos = v_pedidos,
         sincronizado_en = case when p_sincronizado then now() else sincronizado_en end,
         actualizado_en = now()
   where cuenta = p_cuenta
  returning * into v_row;

  return jsonb_build_object('pedidos', v_row.pedidos, 'sincronizado_en', v_row.sincronizado_en);
end
$$;

revoke all on function business.historial_fusionar(text, text, jsonb, boolean) from public, anon;
grant execute on function business.historial_fusionar(text, text, jsonb, boolean) to authenticated;
