-- Check de 20261005100003_endurecer_permisos (auditoría 2026-10-04): vistas solo lectura, guarda de perfiles reservados
-- sobre exist/account_id y tope de 5 comprobantes sin pedido por día. Autolimpiante (ROLLBACK). Necesita un admin, un
-- user y 1 perfil en catalogo_disponible. Devuelve 'endurecer_permisos_check: OK'.
--   supabase db query --linked -f supabase/checks/endurecer_permisos_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_cliente uuid;
  v_p bigint;
  v_total numeric;
  i int;
begin
  assert not has_table_privilege('authenticated', 'business.catalogo_disponible', 'INSERT,UPDATE,DELETE'),
    'catalogo_disponible debe ser solo lectura';
  assert not has_table_privilege('authenticated', 'business.oferta_proveedor', 'INSERT,UPDATE,DELETE'),
    'oferta_proveedor debe ser solo lectura';

  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id
    join security.client c on c.id = ur.auth_user_id and c.exist where r.nombre = 'user' order by ur.id limit 1;
  select profile_id, precio_venta into v_p, v_total from business.catalogo_disponible order by profile_id limit 1;
  assert v_admin is not null and v_cliente is not null and v_p is not null, 'faltan admin, user o un perfil disponible';

  insert into business.ajuste (clave, valor) values ('llave_breb', '@check') on conflict (clave) do update set valor = '@check';
  delete from business.pedido where cliente_id = v_cliente and estado = 'pendiente';
  -- tope de comprobantes sin pedido: hasta 5 entran (contando los que el cliente ya tenga hoy), el siguiente no
  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for i in (business.comprobantes_sin_pedido() + 1)..5 loop
    insert into storage.objects (bucket_id, name, owner_id) values ('comprobantes', v_cliente || '/check-' || i || '.png', v_cliente::text);
  end loop;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('comprobantes', v_cliente || '/check-6.png', v_cliente::text);
    assert false, 'el 6.º comprobante sin pedido no debe entrar';
  exception when insufficient_privilege then null;
  end;

  -- un comprobante usado por un pedido deja de contar
  perform business.crear_pedido(array[v_p], v_cliente || '/check-1.png', v_total);
  insert into storage.objects (bucket_id, name, owner_id) values ('comprobantes', v_cliente || '/check-6.png', v_cliente::text);
  reset role;

  -- el staff no puede desactivar ni mover de cuenta un perfil reservado
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update business.profile set exist = false where id = v_p;
    assert false, 'no debe desactivar un perfil reservado';
  exception when raise_exception then null;
  end;
  begin
    update business.profile set account_id = (select a.id from business.account a where a.id <> profile.account_id limit 1) where id = v_p;
    assert false, 'no debe mover de cuenta un perfil reservado';
  exception when raise_exception then null;
  end;
  reset role;
end
$$;

select 'endurecer_permisos_check: OK' as resultado;
rollback;
