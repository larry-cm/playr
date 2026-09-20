# Playr — guía operativa para Claude

Este archivo centraliza la información que un agente necesita para trabajar en este proyecto sin tener que reconstruir el contexto a ojo.

## 1) Snapshot del proyecto

- Nombre: Playr
- Tipo: aplicación web de gestión de perfiles/cuentas de streaming
- Stack principal:
  - Next.js 16
  - React 19
  - TypeScript
  - Tailwind CSS v4
  - Supabase SSR + Auth
  - Zod para validación
- Objetivo funcional:
  - autenticación de usuarios
  - panel de administración
  - gestión de clientes
  - soporte / dashboard general
  - administración de cuentas y perfiles (futuro o parcialmente implementado)

## 2) Comandos de trabajo

Desde la raíz del proyecto:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
```

Notas:
- El proyecto usa pnpm, no npm/yarn.
- El comando de desarrollo es `pnpm dev` y corre un servidor Next.js local.
- `pnpm lint` ya se ejecutó y actualmente falla; ver sección de estado real al final.

## 3) Variables de entorno requeridas

El proyecto lee estas variables de entorno en `app/lib/const.ts`:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Si faltan, la app no podrá conectarse a Supabase.

## 4) Estructura importante del repo

```text
app/
  action/
    get-role-action.ts
    login/
      login-action.ts
    manager-and-admin/
      resume-service-action.ts
      customers/
        create-customer-action.ts
        delete-customer-action.ts
        edit-customer-action.ts
        get-all-customers-action.ts
  administrar/
    aside.tsx
    dashboard-client.tsx
    layout.tsx
    page.tsx
    view-manager-and-admin.tsx
    view-user.tsx
    clientes/
      page.tsx
      table-client.tsx
  lib/
    const.ts
    countries.ts
    customer-schema.ts
    date.ts
    phone.ts
    validation.ts
    supabase/
      auth-errors.ts
      client.ts
      middleware.ts
      server.ts
  ui/
    alert.tsx
    button.tsx
    card.tsx
    checkbox.tsx
    copy-input.tsx
    count-up.tsx
    input.tsx
    modal.tsx
    password-input.tsx
    phone-input.tsx
    playr-logo.tsx
    select-dropdown.tsx
    select.tsx
    table.tsx
app/page.tsx                # login
app/layout.tsx              # layout global + metadata
public/                     # assets públicos
proxy.ts                    # middleware general de Next (protección de rutas)
package.json
tsconfig.json
README.md
```

## 5) Convenciones de alias y imports

`tsconfig.json` define estos aliases:

```json
"@/*": ["./*"]
"@ui/*": ["./app/ui/*"]
"@lib/*": ["./app/lib/*"]
"@action/*": ["./app/action/*"]
```

Usar estos aliases en lugar de rutas relativas largas. Es el patrón esperado por el proyecto.

## 6) Flujo de autenticación y roles

### Login
- La pantalla inicial está en `app/page.tsx`.
- `loginAction` está en `app/action/login/login-action.ts`.
- Usa Supabase Auth con `signInWithPassword`.
- Si el login es correcto, redirige a `/administrar`.

### Roles
- `getRoleUser()` en `app/action/get-role-action.ts` consultá `supabase.auth.getUser()` y devuelve:
  - `user`
  - `admin`
  - `manager`
  - `error`
- El rol real se toma principalmente desde `user.user_metadata.role`.

### Rutas protegidas
- El layout de dashboard en `app/administrar/layout.tsx` llama `getRoleUser()`.
- El `Aside` filtra items de navegación por rol en `app/administrar/aside.tsx`.
- El archivo `proxy.ts` también intenta proteger `/administrar` con un redirect si no hay usuario autenticado.

Importante: hay una diferencia de modelo aquí:
- `getRoleUser()` usa `user.user_metadata.role`
- `proxy.ts` valida `data.user?.role === "authenticated"`
Esto probablemente no está alineado y es una zona a revisar si aparece bug de permisos.

## 7) Patrones de validación y server actions

### Validación
La capa base está en `app/lib/validation.ts` y usa funciones como:
- `validateEmail`
- `validatePassword`
- `validateUsername`
- `validatePhoneValue`
- `validateConfirmPassword`

### Esquema de cliente
`app/lib/customer-schema.ts` unifica validación para crear/editar clientes usando Zod.

Reglas importantes:
- nombre: solo letras y espacios
- email: validado con `validateEmail`
- teléfono: validado con `validatePhoneValue`
- creación de cliente agrega `password`, `rol` y normalización del teléfono

### Server actions
El proyecto usa `"use server"` y actions en `app/action/...` para:
- login
- obtener role actual
- obtener resumen de servicios
- crear/editar/eliminar clientes

El patrón esperado es recibir `FormData` o un objeto plano y devolver:
- string con error, o
- objeto con `ok`, `error`, `row`

## 8) Dashboard y UI

### Panel principal
- `app/administrar/page.tsx` decide si mostrar `ViewUser` o `ViewManagerAndAdmin` según el rol.
- `app/administrar/view-manager-and-admin.tsx` representa el dashboard de administración con resumen de servicios.
- `app/administrar/view-user.tsx` representa la vista del usuario final.

### Tabla genérica
El componente `app/ui/table.tsx` es central para CRUD en varias pantallas.

Incluye:
- búsqueda
- vista modal
- creación modal
- edición modal
- eliminación con confirmación
- validación por columna
- detección automática de teléfonos
- soporte para campos read-only

Es el componente más importante del front luego del login y del dashboard.

## 9) Autenticación con Supabase

Los clientes de Supabase están en:
- `app/lib/supabase/client.ts` para browser
- `app/lib/supabase/server.ts` para server actions
- `app/lib/supabase/middleware.ts` para manejo de cookies en requests

El proyecto configura la app con `@supabase/ssr` y cookies para sesiones.

## 10) Modelo de negocio / datos relevantes

La lógica de clientes está orientada a una tabla `main.client` y usa estas propiedades:
- `id`
- `username`
- `email`
- `phone`
- `created_at`
- `exist`

También se usa `supabase.auth.signUp` con `options.data` para guardar metadata extra:
- `username`
- `role`
- `phone`

La normalización del teléfono se hace así:
- entrada: texto tipo `+57 3001234567`
- se guarda normalizado con formato estándar
- esta forma se usa para mostrar y validar consistentemente en la UI

## 11) Estilo y convenciones de código

- La UI está íntegramra en español.
- Los mensajes de error y labels son principalmente en español.
- Se usan componentes reutilizables en `app/ui/*`.
- El proyecto prioriza un estilo visual dark con énfasis en cards, bordes suaves y tonos de acento.
- Los nombres de archivos y componentes suelen estar en camelCase/pascalCase según el caso.
- Las acciones del lado servidor llevan `"use server"` explícito.

## 12) Estado real del proyecto (verificado)

Verifiqué esto con `pnpm lint`:

- Resultado: falla con errores reales.
- Conteo verificado: 11 errores y 4 warnings.

Errores principales:
- `app/ui/table.tsx`: uso de `any` en varios puntos y un problema de React hooks (`setState` directo en `useEffect`)
- `app/action/manager-and-admin/customers/create-customer-action.ts`: `any`
- `app/action/manager-and-admin/customers/edit-customer-action.ts`: `any`

Warnings relevantes:
- `delete-customer-action.ts` y `get-all-customers-action.ts`: variables `error` sin usar
- `app/lib/supabase/middleware.ts`: `options` sin usar
- `proxy.ts`: `error` asignado sin uso

En resumen, el proyecto está funcionalmente en desarrollo y no está limpio de lint, así que cualquier cambio que se haga debería considerar este estado antes de cerrar tareas.

## 13) Sugerencias para trabajar sin perder contexto

1. Empezar por revisar `app/page.tsx` y `app/action/login/login-action.ts` para entender login.
2. Luego revisar `app/administrar/page.tsx` y `app/administrar/layout.tsx` para entender navegación y roles.
3. Para CRUD, mirar `app/ui/table.tsx` y las actions de clientes en `app/action/manager-and-admin/customers/*`.
4. Si se toca Supabase o auth, revisar `app/lib/supabase/*` antes de tocar frontend.
5. Si se añade validación, mantener la misma lógica en `app/lib/validation.ts` y en Zod schemas para no desalinear cliente/servidor.
6. Si se corrige un bug, primero reproducir y verificar con lint/tests; este proyecto aún no tiene suite de tests visible.

## 14) Resumen ejecutivo

El proyecto ya tiene una base sólida de Next.js + Supabase + UI reutilizable, pero todavía está en etapa de trabajo activo. La parte más importante para no perder contexto es: login → auth/roles → dashboard → tabla genérica CRUD → acciones server → Supabase.

Si se trabaja con este repo, conviene asumir que:
- la estructura está organizada por feature route y “action” server-side
- la UI está construida en español y con dark mode
- los clientes y usuarios están fuertemente ligados a Supabase Auth + metadata
- el linter no está limpio todavía, así que no todos los cambios serán “green” de entrada

## 15) Agente de administración de Supabase

`.claude/agents/supabase-admin.md` — agente de propósito general para administrar Supabase vía CLI: migraciones, Edge Functions, Storage, secrets. Credenciales en `.env.supabase-cli` (ya existente, `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD` — proyecto linkeado: `tnwcnpzjlpophcqnqrxb`). MCP oficial de Supabase registrado en `.mcp.json` como respaldo de consultas puntuales; las acciones reales van por CLI. El agente pide confirmación antes de cualquier comando que mute datos (`db push`, `functions deploy`, `storage rm`, etc.) — nunca las corre solo.

## 16) Skill de compra al proveedor

`.claude/skills/comprar-proveedor/SKILL.md` — compra en tuproveedor2.com el producto que el usuario elija (`agent-browser` por Bash) y, con la entrega en mano, inserta `business.account` + `business.profile` en estado `disponible` para que vuelvan a `catalogo_disponible`. Gasta dinero real: pide confirmación explícita antes de pagar y verifica DB, clave y login **antes** de comprar. Requiere `ACCOUNT_ENC_KEY` en `.env` (la contraseña se guarda con `pgp_sym_encrypt` en base64; sin la clave no se puede descifrar) y un `SUPABASE_ACCESS_TOKEN` válido. Las credenciales del proveedor (`PLATFORM_*`) viven en `.env.platform` (separado de `.env`, mismo criterio que `.env.supabase-cli`; Next.js lo carga vía `next.config.ts`) — mismo `.env.platform` que usa `inventario-proveedores` (sección 19). El paso de carrito/checkout aún no está validado contra el sitio: la primera corrida debe ser en modo "simulá".

## 17) Sincronización automática del catálogo del proveedor (Edge Function + cron)

`supabase/functions/stock-price-watch/` escanea tuproveedor2.com **sin navegador ni LLM** (login WordPress/Ultimate Member en `/login/` + paginación de `/tienda/` por HTTP plano) y sincroniza `business.*`: una fila en `extraction_run`, un `market_listing_snapshot` por producto y un `market_alert` por cada cambio (agotado / volvió stock / precio). No envía WhatsApp. Productos nuevos se insertan solos en `market_listing` (plataforma deducida por nombre; combos y no reconocidos quedan con `platform_id` null).

- Cron: pg_cron job `stock-price-watch`, `*/30 * * * *` UTC (cada 30 min, en el :00 y el :30; 48 corridas al día; Colombia = UTC-5), creado por la migración `20260920120005_stock_watch_cron.sql` (originalmente cada 6 h) y cambiado a 30 min por `20260920170001_stock_watch_cron_30min.sql`. Llama a la función con pg_net y el header `x-cron-secret`.
- Secrets de la función: `PLATFORM_URL`, `PLATFORM_STORE_PATH`, `PLATFORM_EMAIL`, `PLATFORM_PASSWORD`, `CRON_SECRET`. `CRON_SECRET` debe ser idéntico al secret `cron_secret` de Vault (si se rota uno, rotar el otro).
- Desplegar siempre con `supabase functions deploy stock-price-watch --no-verify-jwt --project-ref tnwcnpzjlpophcqnqrxb`; sin `--no-verify-jwt` el cron recibe 401.
- Identidad de producto = `clave()` en `lib.ts` (ignora mayúsculas, prefijo `z ` de combos, espacios y signos): el sitio y el seed difieren en eso. `lib.ts` es solo `fetch` + regex para poder probarlo fuera de Deno: `node supabase/functions/stock-price-watch/lib_test.ts`.
- La función aborta sin escribir si el login falla, si los productos parseados no igualan el total publicado, o si el catálogo cae a menos de la mitad de la corrida anterior.
- `market_alert.enviado_at` significa "momento de detección" (no hay envío). `extraction_run` solo guarda la fecha, no la hora.
- Operación (ver estado, correr ya, pausar, cambiar horario): `Bobeda de Larry/Informe de productos/manual-tarea-diaria.md`.
- Si una corrida falla (login, parseo, guardas, DB) deja un aviso `error` en la bandeja de notificaciones (sección 18). `?dry=1` nunca avisa.

## 18) Notificaciones (campana + bandeja `business.notificacion`)

Bandeja de avisos **importantes** para admin/manager: fallas y advertencias del scraping y de la plataforma. No es un log ni el historial de stock/precio (eso es `market_alert`). Migraciones `20260920150001_notificacion.sql` y `20260920160001_notificacion_tipos_info_exito.sql`.

- Tabla `business.notificacion`: `origen` (`scraping` | `plataforma`), `tipo` (`error` rojo | `advertencia` ámbar | `info` azul "Novedad" | `exito` verde "Disponible"; define color e icono), `titulo`, `mensaje`, `exist`, `created_at`. "Eliminar" = `exist=false` (soft-delete global, no por usuario): la fila queda en la DB y la UI no la muestra. Nadie hace DELETE ni INSERT directo (sin privilegio).
- RLS: solo admin/manager leen y descartan (el rol `user` no ve nada). Único UPDATE permitido: `exist=false`.
- Crear avisos siempre con `business.notificar(p_origen, p_tipo, p_titulo, p_mensaje)` (security definer): desde Next con `notificar()` de `app/lib/notify.ts` (nunca lanza), desde la Edge Function con `db.rpc("notificar", …)`. Descarta el aviso si ya hay uno idéntico (mismos 4 campos) sin eliminar, así una falla persistente no se acumula; si se elimina y la falla sigue, vuelve a avisar.
- Hoy emiten: `stock-price-watch` (corrida fallida, y los cambios del catálogo del proveedor en cada corrida: `advertencia` se agotó / `exito` volvió el stock (por producto = plataforma + Completa/Pantalla, hay stock si algún listing está disponible; los combos y no reconocidos cuentan cada uno por separado) y `info` productos nuevos; un aviso por tipo y corrida, nunca en la primera corrida; el detalle de todo cambio sigue en `market_alert`), el scraper de licencias de la app (`getLicenciasDisponiblesAction`, `createProductoAction`) y la Tienda (`getCatalogoDisponibleAction`).
- UI: campana en `aside.tsx` (escritorio) y en el header móvil de `dashboard-client.tsx`; drawer lateral en `app/administrar/notificaciones.tsx` con buscador (sin tildes), filtros por tipo y origen, color por tipo y eliminar. Lee las 100 más recientes al cargar y al abrir (sin realtime).
- Check ejecutable (RLS + dedupe; corre en una transacción con ROLLBACK y no deja filas): `supabase db query --linked -f supabase/checks/notificacion_check.sql`.

## 19) Inventario a demanda del proveedor

`.claude/agents/inventario-proveedores.md` — agente que, a pedido explícito del usuario ("dame el inventario", "qué están vendiendo", "revisa la tienda"), hace login en tuproveedor2.com (`agent-browser` CLI por Bash, nunca las tools MCP aunque estén cargadas), pagina `/tienda`, parsea productos y agotados del texto de `read`, clasifica por tipo de servicio y por Completa/Pantalla, y escribe/actualiza un único `.md` por plataforma en `C:\Users\user\Documents\Bobeda de Larry\Informe de productos\inventario-<plataforma>.md` (nunca dentro del repo). Es de solo lectura: nunca compra ni agrega al carrito (eso es `comprar-proveedor`, sección 16). Credenciales en `.env.platform` (mismo archivo que usa `comprar-proveedor`). Antes provenía de un repo separado (`analisis-plataformas`, eliminado el 2026-09-20) — ahora vive acá junto con el resto del flujo del proveedor (`comprar-proveedor` y `stock-price-watch`). Si la estructura del sitio cambia (login, paginación, marcador "Agotado"), el agente para y avisa en vez de asumir.

