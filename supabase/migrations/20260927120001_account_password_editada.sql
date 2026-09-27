-- La contraseña de una cuenta se muestra en vivo desde el proveedor ("Mis licencias"), salvo que el staff la haya
-- editado a mano en Perfiles: desde ese momento manda la guardada (password_enc). password_editada_at marca ese momento;
-- null = nunca editada (la guardada es la de la compra y la vigente se lee del proveedor).
alter table business.account add column if not exists password_editada_at timestamptz;

comment on column business.account.password_editada_at is
  'Momento en que el staff editó la contraseña a mano. null = se muestra la del proveedor; no null = se muestra password_enc.';

-- Descifra la contraseña guardada de una cuenta. Solo admin/manager (business.es_staff()). La clave viaja como parámetro
-- (por TLS) en cada llamada, nunca se guarda en la función. null = la cuenta no existe o no tiene contraseña.
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
  if not business.es_staff() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select a.password_enc into v_enc from business.account a where a.id = p_account_id and a.exist;
  if v_enc is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(decode(v_enc, 'base64'), p_enc_key);
end
$$;

revoke all on function business.decrypt_account_password(bigint, text) from public, anon;
grant execute on function business.decrypt_account_password(bigint, text) to authenticated;
