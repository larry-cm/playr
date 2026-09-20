-- Cron de stock-price-watch cada 30 minutos (antes cada 6 h, migracion 20260920120005): 00 y 30 de cada hora, UTC.
-- Solo cambia el horario del job existente; el comando (pg_net + secret de Vault) no se toca.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'stock-price-watch'),
  schedule := '*/30 * * * *'
);
