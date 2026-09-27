# stock-price-watch — Sincronización automática del catálogo del proveedor (Edge Function + cron)

`supabase/functions/stock-price-watch/` escanea tuproveedor2.com **sin navegador ni LLM** (login WordPress/Ultimate Member en `/login/` + paginación de `/tienda/` por HTTP plano) y sincroniza `business.*`: una fila en `extraction_run`, un `market_listing_snapshot` por producto y un `market_alert` por cada cambio (agotado / volvió stock / precio). No envía WhatsApp. Productos nuevos se insertan solos en `market_listing` (plataforma deducida por nombre; combos y no reconocidos quedan con `platform_id` null).

- Cron: pg_cron job `stock-price-watch`, `*/30 * * * *` UTC (cada 30 min, en el :00 y el :30; 48 corridas al día; Colombia = UTC-5), creado por la migración `20260920120005_stock_watch_cron.sql` (originalmente cada 6 h) y cambiado a 30 min por `20260920170001_stock_watch_cron_30min.sql`. Llama a la función con pg_net y el header `x-cron-secret`.
- Secrets de la función: `PLATFORM_URL`, `PLATFORM_STORE_PATH`, `PLATFORM_EMAIL`, `PLATFORM_PASSWORD`, `CRON_SECRET`. `CRON_SECRET` debe ser idéntico al secret `cron_secret` de Vault (si se rota uno, rotar el otro).
- Desplegar siempre con `supabase functions deploy stock-price-watch --no-verify-jwt --project-ref tnwcnpzjlpophcqnqrxb`; sin `--no-verify-jwt` el cron recibe 401.
- Identidad de producto = `clave()` en `lib.ts` (ignora mayúsculas, prefijo `z ` de combos, espacios y signos): el sitio y el seed difieren en eso. `lib.ts` es solo `fetch` + regex para poder probarlo fuera de Deno: `node supabase/functions/stock-price-watch/lib_test.ts`.
- La función aborta sin escribir si el login falla, si los productos parseados no igualan el total publicado, o si el catálogo cae a menos de la mitad de la corrida anterior.
- `market_alert.enviado_at` significa "momento de detección" (no hay envío). `extraction_run.created_at` guarda la hora del escaneo desde la migración `20260927210001` (las corridas anteriores quedan en NULL, solo con `fecha_extraccion`).
- Operación (ver estado, correr ya, pausar, cambiar horario): `Bobeda de Larry/Informe de productos/manual-tarea-diaria.md`.
- Si una corrida falla (login, parseo, guardas, DB) deja un aviso `error` en la bandeja de notificaciones (sección 18 del `CLAUDE.md` raíz). `?dry=1` nunca avisa.

