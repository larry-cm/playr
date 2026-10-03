-- El job nocturno de Railway (jobs/historial-proveedor/) sincroniza el registro de compras con la clave secreta (service_role),
-- sin sesion de un usuario: historial_fusionar ahora acepta service_role ademas de admin/manager. Mismo criterio que
-- business.notificar (migracion 20260927200001). El resto de la funcion queda identico a 20261003120001.
--   * "is not distinct from": sin claim de rol auth.role() es null y la condicion no debe quedar en null (un if null no lanza).

create or replace function business.historial_fusionar(p_cuenta text, p_host text, p_pedidos jsonb, p_sincronizado boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row business.historial_proveedor;
  v_pedidos jsonb;
begin
  if not ((select auth.role()) is not distinct from 'service_role' or business.es_staff()) then
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
grant execute on function business.historial_fusionar(text, text, jsonb, boolean) to authenticated, service_role;
