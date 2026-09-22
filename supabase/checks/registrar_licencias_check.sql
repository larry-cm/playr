-- Verifica la migración 20260922025911_registrar_licencias_agrupa_cuenta.sql contra la base real,
-- dentro de una transacción que termina en ROLLBACK: no deja filas ni cambios de esquema.
--   supabase db query --linked -f supabase/checks/registrar_licencias_check.sql
--
-- Corre igual ANTES de aplicar la migración (prueba la función vieja y falla mostrando el motivo)
-- o DESPUÉS (confirma el comportamiento nuevo). Necesita al menos un admin/manager en
-- security.user_role: registrar_licencias exige business.es_staff().
begin;

do $$
declare
  v_staff uuid;
  v_platform bigint;
  v_result jsonb;
  v_account_a bigint;
  v_account_b bigint;
  v_n_accounts int;
  v_n_profiles int;
  v_perfil_max int;
begin
  select ur.auth_user_id into v_staff
    from security.user_role ur join security.role r on r.id = ur.role_id
   where r.nombre in ('admin', 'manager') limit 1;
  assert v_staff is not null, 'falta un admin/manager para probar';
  perform set_config('request.jwt.claim.sub', v_staff::text, true);
  set local role authenticated;

  select id into v_platform from business.platform where exist order by id limit 1;

  -- 1) dos perfiles del MISMO correo+plataforma deben caer en UNA sola cuenta
  v_result := business.registrar_licencias(
    jsonb_build_array(
      jsonb_build_object('platform_id', v_platform, 'access_type', 'pantalla', 'email', 'check.agrupa@example.com',
                          'password', 'x', 'perfil', 'PERFIL 1', 'pin', null, 'vence', null, 'costo', 1000),
      jsonb_build_object('platform_id', v_platform, 'access_type', 'pantalla', 'email', 'CHECK.AGRUPA@example.com',
                          'password', 'x', 'perfil', 'PERFIL 2', 'pin', null, 'vence', null, 'costo', 1000)
    ),
    'clave-de-prueba-suficientemente-larga'
  );
  if (v_result->>'registradas')::int <> 2 then
    raise exception 'FALLA: se esperaban 2 perfiles registrados, salió %', v_result;
  end if;

  select count(distinct a.id), count(p.id) into v_n_accounts, v_n_profiles
    from business.account a join business.profile p on p.account_id = a.id
   where a.exist and p.exist and a.platform_id = v_platform and lower(a.email) = 'check.agrupa@example.com';
  if v_n_accounts <> 1 or v_n_profiles <> 2 then
    raise exception 'FALLA: 2 perfiles del mismo correo abrieron % cuenta(s) con % perfil(es), se esperaba 1 cuenta con 2', v_n_accounts, v_n_profiles;
  end if;

  select id, perfil_max into v_account_a, v_perfil_max from business.account
   where exist and platform_id = v_platform and lower(email) = 'check.agrupa@example.com';
  if v_perfil_max <> 2 then
    raise exception 'FALLA: perfil_max quedó en %, se esperaba 2 (cantidad real de perfiles vivos)', v_perfil_max;
  end if;

  -- 2) un correo DISTINTO en la misma plataforma abre su propia cuenta (no se mezcla con la de arriba)
  v_result := business.registrar_licencias(
    jsonb_build_array(
      jsonb_build_object('platform_id', v_platform, 'access_type', 'pantalla', 'email', 'check.suelto@example.com',
                          'password', 'x', 'perfil', 'PERFIL 1', 'pin', null, 'vence', null, 'costo', 1000)
    ),
    'clave-de-prueba-suficientemente-larga'
  );
  select id into v_account_b from business.account
   where exist and platform_id = v_platform and lower(email) = 'check.suelto@example.com';
  if v_account_b = v_account_a then
    raise exception 'FALLA: un correo distinto terminó agrupado en la cuenta de otro correo';
  end if;

  -- 3) repetir exactamente el primer grupo no crea un perfil nuevo (sigue deduplicando por
  --    plataforma+correo+perfil+vencimiento, la regla de antes de esta migración)
  v_result := business.registrar_licencias(
    jsonb_build_array(
      jsonb_build_object('platform_id', v_platform, 'access_type', 'pantalla', 'email', 'check.agrupa@example.com',
                          'password', 'x', 'perfil', 'PERFIL 1', 'pin', null, 'vence', null, 'costo', 1000)
    ),
    'clave-de-prueba-suficientemente-larga'
  );
  if (v_result->>'duplicadas')::int <> 1 then
    raise exception 'FALLA: repetir el mismo grupo debía contar como duplicada, salió %', v_result;
  end if;

  -- 4) la regla de "es cuenta" que va a usar get-all-cuentas-action (perfiles_total > 1): la cuenta
  --    agrupada de 2 perfiles califica, la de 1 perfil suelto no.
  if (select count(*) from business.profile where account_id = v_account_a and exist) <= 1 then
    raise exception 'FALLA: la cuenta agrupada no califica como cuenta (perfiles_total > 1)';
  end if;
  if (select count(*) from business.profile where account_id = v_account_b and exist) > 1 then
    raise exception 'FALLA: el perfil suelto terminó con más de 1 perfil vivo';
  end if;

  raise notice 'OK: registrar_licencias agrupa por plataforma+correo y perfil_max queda correcto';
end
$$;

rollback;
