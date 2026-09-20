-- RPC para que server actions (solo tienen el cliente supabase-js, sin psql directo) puedan cifrar
-- password de business.account con la misma funcion pgcrypto que usa comprar-proveedor por SQL
-- directo. La clave viaja como parametro (por TLS) en cada llamada, nunca se guarda en la funcion.
create or replace function business.encrypt_account_password(password text, enc_key text)
returns text
language sql
security invoker
set search_path = extensions
as $$
  select encode(pgp_sym_encrypt(password, enc_key), 'base64')
$$;

revoke all on function business.encrypt_account_password(text, text) from public;
grant execute on function business.encrypt_account_password(text, text) to authenticated;
