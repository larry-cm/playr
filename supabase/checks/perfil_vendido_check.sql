-- Check de profile.vendido_pedido_id (auditoría 2026-10-04): aprobar liga el perfil al pedido, el staff no puede
-- reasignarlo a mano y liberar el perfil suelta al comprador anterior. Autolimpiante (ROLLBACK). Necesita un admin,
-- un user y 1 perfil en catalogo_disponible. Devuelve 'perfil_vendido_check: OK'.
--   supabase db query --linked -f supabase/checks/perfil_vendido_check.sql
begin;

do $$
declare
  v_admin uuid;
  v_cliente uuid;
  v_p bigint;
  v_total numeric;
  v_pedido bigint;
  v_liga bigint;
begin
  select ur.auth_user_id into v_admin from security.user_role ur join security.role r on r.id = ur.role_id where r.nombre = 'admin' limit 1;
  select ur.auth_user_id into v_cliente from security.user_role ur join security.role r on r.id = ur.role_id
    join security.client c on c.id = ur.auth_user_id and c.exist where r.nombre = 'user' order by ur.id limit 1;
  select profile_id, precio_venta into v_p, v_total from business.catalogo_disponible order by profile_id limit 1;
  assert v_admin is not null and v_cliente is not null and v_p is not null, 'faltan admin, user o un perfil disponible';

  insert into business.ajuste (clave, valor) values ('llave_breb', '@check') on conflict (clave) do update set valor = '@check';
  insert into storage.objects (bucket_id, name) values ('comprobantes', v_cliente || '/check-vendido.png');
  delete from business.pedido where cliente_id = v_cliente and estado = 'pendiente';

  perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_pedido := business.crear_pedido(array[v_p], v_cliente || '/check-vendido.png', v_total);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform business.aprobar_pedido(v_pedido);

  select vendido_pedido_id into v_liga from business.profile where id = v_p;
  assert v_liga = v_pedido, 'aprobar debe ligar el perfil al pedido';

  update business.profile set vendido_pedido_id = null where id = v_p;
  select vendido_pedido_id into v_liga from business.profile where id = v_p;
  assert v_liga = v_pedido, 'el staff no puede cambiar vendido_pedido_id a mano';

  update business.profile set estado = 'disponible' where id = v_p;
  select vendido_pedido_id into v_liga from business.profile where id = v_p;
  assert v_liga is null, 'liberar el perfil debe soltar al comprador anterior';
  reset role;
end
$$;

select 'perfil_vendido_check: OK' as resultado;
rollback;
