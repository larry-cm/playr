-- Cron de la Edge Function stock-price-watch: 4 veces por dia (cada 6 h; 00, 06, 12 y 18 UTC = 19, 01, 07 y 13 hora Colombia).
-- Antes de aplicar: crear en Vault el secret 'cron_secret' (mismo valor que el secret CRON_SECRET de la funcion). No va en git.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- cron.schedule con el mismo nombre actualiza el job (idempotente)
select cron.schedule(
  'stock-price-watch',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://tnwcnpzjlpophcqnqrxb.supabase.co/functions/v1/stock-price-watch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 120000
  );
  $$
);
