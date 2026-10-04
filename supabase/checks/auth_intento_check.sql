-- Check del límite de intentos de login/recuperación (security.auth_intento, auditoría 2026-10-04): topes por
-- correo+IP, por IP y por correo, mayúsculas del correo, descartar/limpiar y que solo service_role pueda llamarlo.
-- Autolimpiante (ROLLBACK). Devuelve 'auth_intento_check: OK'.
--   supabase db query --linked -f supabase/checks/auth_intento_check.sql
begin;

do $$
declare
  r record;
  i int;
  v_id bigint;
begin
  assert not has_function_privilege('authenticated', 'security.auth_intentar(text, text, text)', 'EXECUTE'), 'authenticated no debe poder llamar auth_intentar';
  assert not has_function_privilege('anon', 'security.auth_intentar(text, text, text)', 'EXECUTE'), 'anon no debe poder llamar auth_intentar';
  assert has_function_privilege('service_role', 'security.auth_intentar(text, text, text)', 'EXECUTE'), 'service_role debe poder llamar auth_intentar';
  delete from security.auth_intento where email like '%@check.invalid' or ip like '10.255.%';

  -- login: 5 por correo+IP (sin importar mayúsculas), el 6.º se corta
  for i in 1..5 loop
    select * into r from security.auth_intentar('login', '10.255.0.1', 'Victima@check.invalid');
    assert r.intento_id is not null, 'los primeros 5 intentos deben pasar';
  end loop;
  select * into r from security.auth_intentar('login', '10.255.0.1', 'victima@check.invalid');
  assert r.intento_id is null and r.motivo = 'correo_ip', 'el 6.º intento desde la misma IP debe cortarse';

  -- desde otra IP el dueño sigue pudiendo entrar (5 fallos ajenos no le bloquean la cuenta)
  select * into r from security.auth_intentar('login', '10.255.0.2', 'victima@check.invalid');
  assert r.intento_id is not null, 'otra IP no debe quedar bloqueada por fallos ajenos';

  -- descartar: un intento que Auth rechazó por su cuenta deja de contar
  perform security.auth_descartar(r.intento_id);
  assert not exists (select 1 from security.auth_intento where id = r.intento_id), 'auth_descartar debe borrar el intento';

  -- limpiar: un login correcto borra los intentos del correo
  perform security.auth_limpiar('VICTIMA@check.invalid');
  select * into r from security.auth_intentar('login', '10.255.0.1', 'victima@check.invalid');
  assert r.intento_id is not null, 'tras un login correcto el correo vuelve a poder intentar';

  -- por correo desde muchas IPs: 50 en total
  delete from security.auth_intento where email = 'victima@check.invalid';
  for i in 1..50 loop
    select * into r from security.auth_intentar('login', '10.255.1.' || i, 'victima@check.invalid');
  end loop;
  select * into r from security.auth_intentar('login', '10.255.2.1', 'victima@check.invalid');
  assert r.intento_id is null and r.motivo = 'correo', 'el intento 51 contra un correo debe cortarse';

  -- por IP: 30 en total con correos distintos
  for i in 1..30 loop
    select * into r from security.auth_intentar('login', '10.255.3.1', 'u' || i || '@check.invalid');
  end loop;
  select * into r from security.auth_intentar('login', '10.255.3.1', 'otro@check.invalid');
  assert r.intento_id is null and r.motivo = 'ip', 'el intento 31 desde una IP debe cortarse';

  -- recuperar: 3 por correo por hora
  for i in 1..3 loop
    select * into r from security.auth_intentar('recuperar', '10.255.4.' || i, 'reset@check.invalid');
  end loop;
  select * into r from security.auth_intentar('recuperar', '10.255.4.9', 'reset@check.invalid');
  assert r.intento_id is null and r.motivo = 'correo', 'el 4.º pedido de recuperación del correo debe cortarse';
end
$$;

select 'auth_intento_check: OK' as resultado;
rollback;
