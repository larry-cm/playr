# Job nocturno: registro de compras del proveedor

Servicio cron de Railway que, una vez al día, lee todos los pedidos de la cuenta del proveedor (login + `/mi-cuenta/orders/` hasta 20 páginas + "Mis licencias") y los fusiona en `business.historial_proveedor` con `business.historial_fusionar`, igual que el botón «Sincronizar» de Bodega. Así la página abre con el registro del día sin esperar al sitio. La sincronización perezosa de la página (más de 24 h) sigue como respaldo.

- **Horario**: `0 5 * * *` UTC = 00:00 hora de Colombia (Railway usa UTC). Corre, termina y sale (`restartPolicyType: NEVER`).
- **Código**: `sync.ts` (Node puro, reusa `app/lib/bodega/proveedor.ts` e `historial.ts`; no importa Next). Usa la clave secreta (service_role): requiere la migración `20261003130001_historial_fusionar_service_role.sql` aplicada.
- **Salida**: una línea JSON (`leidos`, `guardados`, `sincronizado_en`, `ms`) y exit 0. Si falla, deja el aviso en la campana (mismos títulos que la app), lo escribe en el log y sale con 1.
- **Imagen**: `Dockerfile` en dos etapas; esbuild empaqueta todo en un solo `sync.mjs` (~250 KB) y la imagen final es `node:24-alpine` + ese archivo, con usuario `node`.

## Variables (Railway → servicio → Variables)

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (también sirve `SUPABASE_URL`) |
| `SUPABASE_SECRET_KEY` | clave secreta (`sb_secret_…`), la misma de `.env` |
| `PLATFORM_URL` | URL del proveedor, la de `.env.platform` |
| `PLATFORM_EMAIL` | correo de la cuenta del proveedor |
| `PLATFORM_PASSWORD` | contraseña de la cuenta del proveedor |
| `PLATFORM_STORE_PATH` | opcional (por defecto `tienda`) |

El correo y la URL deben ser los mismos que usa la app: la fila del registro se identifica por `sha256(host|email)`.

## Despliegue actual (Railway, creado 2026-10-03)

- Proyecto `playr-jobs`, servicio `historial-proveedor`, entorno `production`, sin dominio público. Los IDs y el token de proyecto están en `.env.railway-cli` (raíz del repo principal, fuera de git; `RAILWAY_API_TOKEN` es el token de workspace: con él el CLI responde "Unauthorized" en `whoami`/`list`/`init`, pero la API GraphQL `https://backboard.railway.com/graphql/v2` funciona).
- **Redesplegar** tras cambiar `sync.ts` o `app/lib/bodega/*`: `bash jobs/historial-proveedor/deploy.sh`. Empaqueta en local con esbuild y sube solo `sync.mjs` + `Dockerfile.runtime` + `railway.runtime.json` (~70 KB, build de segundos, imagen `node:24-alpine` + el bundle). No está conectado a GitHub: un push no redespliega.
- Cron `0 5 * * *`, `restartPolicyType: NEVER`, 1 réplica: solo consume los ~3-5 s que dura cada corrida.
- Ejecutar ya (prueba): mutation `deploymentInstanceExecutionCreate(input:{serviceInstanceId})`. El log del job sale como atributos (Railway parsea la línea JSON): consultar `deploymentLogs { message attributes { key value } }`.
- `Dockerfile` + `railway.json` (build multi-etapa desde el repo) quedan como alternativa si algún día se conecta el servicio a GitHub.

## Correr local

```bash
pnpm dlx esbuild@0.28.2 jobs/historial-proveedor/sync.ts --bundle --platform=node --target=node24 --format=esm --minify --outfile=jobs/historial-proveedor/dist/sync.mjs
node --env-file=.env --env-file=.env.platform jobs/historial-proveedor/dist/sync.mjs
```

O con Docker (desde la raíz): `docker build -f jobs/historial-proveedor/Dockerfile -t playr-historial-job .` y `docker run --rm --env-file .env --env-file .env.platform playr-historial-job`. Ojo: escribe en la base real y entra al sitio del proveedor (solo lee, nunca compra).
