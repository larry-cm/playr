-- Datos propios por perfil. Un perfil "virgen" hereda el correo de su cuenta y su contraseña se lee en vivo del proveedor;
-- si el staff le edita el correo o la contraseña en Perfiles, ESE perfil (y solo ese) pasa a usar lo guardado aquí.
--   email               null = hereda account.email
--   password_enc        contraseña editada, cifrada igual que account.password_enc (pgp_sym_encrypt + base64)
--   password_editada_at null = nunca editada (se muestra la del proveedor); no null = se muestra password_enc
alter table business.profile add column if not exists email text;
alter table business.profile add column if not exists password_enc text;
alter table business.profile add column if not exists password_editada_at timestamptz;

comment on column business.profile.email is 'Correo propio del perfil (editado a mano). null = hereda el de su cuenta.';
comment on column business.profile.password_editada_at is
  'Momento en que el staff editó la contraseña del perfil. null = se muestra la del proveedor; no null = password_enc del perfil.';

-- Descifra la contraseña editada de un perfil. Solo admin/manager. null = el perfil no existe o no tiene una editada.
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
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select p.password_enc into v_enc from business.profile p where p.id = p_profile_id and p.exist;
  if v_enc is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(decode(v_enc, 'base64'), p_enc_key);
end
$$;

revoke all on function business.decrypt_profile_password(bigint, text) from public, anon;
grant execute on function business.decrypt_profile_password(bigint, text) to authenticated;
