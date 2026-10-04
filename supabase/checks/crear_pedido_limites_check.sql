-- Check de 20261005100004_crear_pedido_limites (auditoría 2026-10-04): 1 pedido pendiente por cliente, hasta 5
-- perfiles por pedido y un cliente dado de baja no puede pedir. Autolimpiante (ROLLBACK). Necesita un user y 1 perfil
-- en catalogo_disponible. Devuelve 'crear_pedido_limites_check: OK'.
--   supabase db query --linked -f supabase/checks/crear_pedido_limites_check.sql
begin;

do $$
declare
  v_cliente uuid;
  v_p bigint;
  v_total numeric;
  v_llave bigint;
begin
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id
    join security.client c on c.id = ur.auth_user_id and c.exist where r.nombre = 'user'
    and not exists (select 1 from business.pedido pe where pe.cliente_id = ur.auth_user_id and pe.estado = 'pendiente')
    order by ur.id limit 1;
  select profile_id, precio_venta into v_p, v_total from business.catalogo_disponible order by profile_id limit 1;
  assert v_cliente is not null and v_p is not null, 'faltan un user o un perfil disponible';

  insert into business.llave_breb (nombre, llave) values ('Check', '@check') returning id into v_llave;
  insert into storage.objects (bucket_id, name) values
    ('comprobantes', v_cliente || '/check-lim-1.png'), ('comprobantes', v_cliente || '/check-lim-2.png');

  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);

  -- un cliente dado de baja no puede pedir
  update security.client set exist = false where id = v_cliente;
  set local role authenticated;
  begin
    perform business.crear_pedido(array[v_p], v_cliente || '/check-lim-1.png', v_total, v_llave);
    assert false, 'un cliente dado de baja no debe poder pedir';
  exception when raise_exception then
    assert sqlerrm like 'Tu cuenta está dada de baja%', 'debe cortarse por la baja: ' || sqlerrm;
  end;
  reset role;
  update security.client set exist = true where id = v_cliente;
  set local role authenticated;

  begin
    perform business.crear_pedido(array[1, 2, 3, 4, 5, 6]::bigint[], v_cliente || '/check-lim-1.png', v_total, v_llave);
    assert false, 'no debe aceptar más de 5 perfiles';
  exception when invalid_parameter_value then null;
  end;

  perform business.crear_pedido(array[v_p], v_cliente || '/check-lim-1.png', v_total, v_llave);
  begin
    perform business.crear_pedido(array[v_p], v_cliente || '/check-lim-2.png', v_total, v_llave);
    assert false, 'no debe aceptar un segundo pedido pendiente';
  exception when raise_exception then
    assert sqlerrm like 'Ya tienes un pago por verificar%', 'el segundo pedido debe cortarse por el pendiente: ' || sqlerrm;
  end;
  reset role;

end
$$;

select 'crear_pedido_limites_check: OK' as resultado;
rollback;
