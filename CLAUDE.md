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
- `pnpm lint` y `pnpm build` pasan (ver sección 12).

## 3) Variables de entorno requeridas

El proyecto lee estas variables de entorno en `app/lib/const.ts`:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY            # solo servidor: crear usuarios, asignar roles, avisos (app/lib/supabase/admin.ts)
NEXT_PUBLIC_SITE_URL           # URL pública; la usa el enlace de recuperar contraseña
NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER  # solo respaldo: el número del asesor lo edita el admin en /administrar/ajustes (business.ajuste, clave whatsapp_asesor; getWhatsappAsesor() en app/lib/ajustes.ts)
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
- `getRoleUser()` (`app/action/get-role-action.ts`, envuelto en React `cache()`) devuelve `user | admin | manager | error`. El rol vive en **`security.user_role`** (no en `user_metadata`, que el usuario puede editar); si falta, "user".
- `business.es_staff()` (security definer) lee la misma tabla y es la base de toda la RLS.
- **Nadie asigna roles desde el cliente**: `security.user_role`/`role` no tienen INSERT/UPDATE/DELETE para `authenticated`. Los asigna el servidor con `createSupabaseAdmin()` (clave secreta) después de verificar que quien llama es admin.
- **Registro público cerrado** en Supabase Auth (`disable_signup`). Los usuarios los crea el staff en Clientes (`createCustomerAction` → `auth.admin.createUser`; contraseña escrita por el staff con las reglas de `validatePassword`; solo un admin puede crear admin/manager).

### Rutas protegidas
- `proxy.ts` solo exige sesión en `/administrar` (`data.user.role === "authenticated"` es el rol JWT, no el de la app).
- **Toda server action de `manager-and-admin` empieza con `if (!(await esStaff())) return …`** (`app/lib/auth.ts`) y toda página de staff redirige si el rol no es admin/manager. Las actions son endpoints POST públicos: ocultar el botón no protege nada.
- RLS (migración `20260927200001_seguridad_rls_por_rol.sql`): `business.*` y `security.*` solo staff; datos del proveedor/mercado solo lectura (los escribe la Edge Function con service_role); el cliente solo ve su fila de rol/cliente y `business.catalogo_disponible` (vista con permisos del dueño, sin costos). El esquema viejo `main` quedó cerrado y fuera de la API (respaldo en `../playr-backups/main-2026-09-27/`).

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

### Dashboard (inicio, `/administrar`)
- En el menú se llama **Dashboard** (la ruta sigue siendo `/administrar`).
- Staff: Resumen de servicios + **Compras a proveedores** (`app/administrar/(inicio)/compras-card.tsx`), con el registro de compras guardado de Bodega (`getHistorialAction`, `business.historial_proveedor`). Si la última sincronización tiene más de 24 h, se sincroniza sola en segundo plano, igual que Bodega. Muestra rangos 30 días/90 días/12 meses/Todo (por día/semana/mes), indicadores (gastado vs. período anterior, pedidos, ticket promedio, mayor compra) y barras de gasto apiladas por **plataforma** (`plataformaDe()`, mismo criterio que `clasificar` del scraper, contra `business.platform`; COMBO = "Combos"; sin plataforma reconocida, el producto es su propio grupo con su nombre: nunca un grupo "Otras" sin identificar, pedido del usuario). La leyenda va dentro del gráfico y solo tiene nombre y color de cada plataforma (pedido del usuario: sin tabla); el tooltip detalla cada plataforma del período con sus productos y el precio del producto completo (nunca precio por pantalla); con el mouse (o un toque) sobre un tramo, ese tramo se resalta (los demás quedan atenuados pero visibles) y en el tooltip se resalta esa plataforma entre todas las del período. Colores: el **oficial de cada plataforma** (`COLOR_MARCA` en `compras-card.tsx`, pedido del usuario; Max aclarado para el fondo oscuro, Apple TV en blanco, Combos en amarillo); una plataforma sin color de marca toma el siguiente de la paleta categórica. Cada plataforma es su propia serie y siempre ocupa el mismo lugar en la pila (orden por gasto de todo el historial). El eje de dinero va de 0 a la barra más alta, sin margen extra (pedido del usuario). La agregación es pura y está en `app/lib/bodega/consumo.ts`: hora de Colombia, sin anulados. **Cada producto ya trae su precio completo** (un combo o una cuenta de 3 pantallas es UN producto con un solo precio; decisión del usuario 2026-10-03): `cantidad` del historial cuenta licencias entregadas, no productos, así que solo se muestra como "N pantallas" y nunca divide el precio. Las cuentas de una plataforma suman en esa plataforma; los combos (varias plataformas) en "Combos". El proveedor solo da el total del pedido, así que con un producto el precio es exacto y con varios (`preciosDe`) cada uno toma su precio de referencia (pedidos donde vino solo, el más cercano en el tiempo) y el resto va a los que no tienen; la suma de las líneas es siempre el total del pedido. En pantalla no se marca ningún precio como aproximado (pedido del usuario).
- Staff: **Ganancia por compras** (`app/administrar/(inicio)/margen-card.tsx`, lógica pura `evolucionGanancia()` en `app/lib/bodega/margen.ts`), debajo de Compras a proveedores (una debajo de la otra, pedido del usuario). Selector de rango (`selector-rango.tsx`, el mismo de Compras a proveedores; las dos tarjetas arrancan en Todo). **Barras apiladas por período** (`gananciaPorPeriodo()`, mismos períodos que Compras vía `ejeDeTiempo()` de consumo.ts: día/semana/mes): abajo en naranja lo que pagamos, arriba en verde lo que ganamos, con el monto ganado escrito encima; la barra completa es el valor de venta (pedido del usuario: que se entienda cuál es la ganancia). Cada producto comprado al proveedor que corresponde a un producto activo del catálogo con `precio_venta` (misma plataforma + forma: pantalla/completa según el nombre del producto del proveedor; sin combos) suma lo pagado exacto (`preciosDe`: total del pedido si trae un producto, o `productos[].precio` leído del detalle del pedido si trae varios) y su precio de venta de hoy. Indicadores (sumas del rango): ganancia (con margen %), invertido (n.º de compras), valor de venta y ganancia por cada $1.000 invertidos; el tooltip lista las compras del período (pagado → venta). No hay registro de ventas a clientes: es la ganancia si cada compra se vende al precio del catálogo, no ventas reales.
- Gráficos: Recharts envuelto al estilo shadcn/ui en `app/ui/chart.tsx` (`ChartContainer` + `ChartConfig`; cada serie se usa como `var(--color-<clave>)`; `marcasEje()` = marcas redondas del eje). No hay `components.json` ni `cn`: el componente se adaptó a mano al tema oscuro. Colores de marca de las plataformas en `app/lib/colores-plataforma.ts`.

### Carga sin saltos (skeletons)
- Cada ruta de `/administrar/*` tiene su `loading.tsx`, que renderiza **el mismo componente cliente** con los datos en `undefined` (= cargando): mismo marco, barra, filtros y filas (`SkeletonRows`/`SkeletonCards`/`SkeletonBar` de `app/ui/data-frame.tsx`, h-5 = una línea de text-sm). Nunca un esqueleto genérico.
- El `PageHeader` de cada ruta vive en su `layout.tsx` (no en `page.tsx`), así no se repinta al llegar los datos.
- El inicio está en el grupo `app/administrar/(inicio)/` para que su `loading.tsx` (que elige la vista por rol con `useRol()` de `dashboard-client.tsx`) no sea el fallback de las demás rutas.

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

## 12) Estado real del proyecto (verificado 2026-09-27)

- `pnpm lint`, `pnpm exec tsc --noEmit` y `pnpm build` pasan limpios. `supabase/functions/**` (Deno) está excluido de lint y de tsconfig; se prueba con `node supabase/functions/stock-price-watch/lib_test.ts`.
- Auditoría de seguridad + UX aplicada (rama `fix/auditoria-seguridad-ux`): roles/RLS por rol (sección 6), headers de seguridad en `next.config.ts`, `error.tsx`/`loading.tsx`/`not-found.tsx`, títulos por ruta, accesibilidad de `Modal`/`SelectDropdown`/inputs.
- Checks de `supabase/checks/` pasan (bodega_check ajustado a cuentas agrupadas por plataforma+correo). Si `db query --linked` da 401 (token vencido), correrlos con `psql` contra el pooler (puerto 5432) y la contraseña de la DB.
- Pendiente de decidir: `registrar_licencias` no es idempotente en renovaciones (mismo correo+perfil, otro vencimiento: agrega el perfil otra vez sin guardar el vencimiento/clave nuevos) y agrupa Completa con Pantalla si comparten correo.

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

Detalle completo en `supabase/functions/stock-price-watch/CLAUDE.md` (se carga solo al trabajar en esa carpeta): cron cada 30 min, secrets, deploy con `--no-verify-jwt`, guardas y operación.

## 18) Notificaciones (campana + bandeja `business.notificacion`)

Bandeja de avisos **importantes** para admin/manager: fallas y advertencias del scraping y de la plataforma. No es un log ni el historial de stock/precio (eso es `market_alert`). Migraciones `20260920150001_notificacion.sql` y `20260920160001_notificacion_tipos_info_exito.sql`.

- Tabla `business.notificacion`: `origen` (`scraping` | `plataforma`), `tipo` (`error` rojo | `advertencia` ámbar | `info` azul "Novedad" | `exito` verde "Disponible"; define color e icono), `titulo`, `mensaje`, `exist`, `created_at`. "Eliminar" = `exist=false` (soft-delete global, no por usuario): la fila queda en la DB y la UI no la muestra. Nadie hace DELETE ni INSERT directo (sin privilegio).
- RLS: solo admin/manager leen y descartan (el rol `user` no ve nada). Único UPDATE permitido: `exist=false`.
- Crear avisos siempre con `business.notificar(p_origen, p_tipo, p_titulo, p_mensaje)` (security definer; solo inserta si llama staff o service_role, para un cliente no hace nada): desde Next con `notificar()` de `app/lib/notify.ts` (nunca lanza; usa la clave secreta si está, así avisa aunque la falla ocurra en una acción de cliente), desde la Edge Function con `db.rpc("notificar", …)`. Descarta el aviso si ya hay uno idéntico (mismos 4 campos) sin eliminar, así una falla persistente no se acumula; si se elimina y la falla sigue, vuelve a avisar.
- Hoy emiten: `stock-price-watch` (corrida fallida, y los cambios del catálogo del proveedor en cada corrida: `advertencia` se agotó / `exito` volvió el stock (por producto = plataforma + Completa/Pantalla, hay stock si algún listing está disponible; los combos y no reconocidos cuentan cada uno por separado) y `info` productos nuevos; un aviso por tipo y corrida, nunca en la primera corrida; el detalle de todo cambio sigue en `market_alert`), el scraper de licencias de la app (`getLicenciasDisponiblesAction`, `createProductoAction`) y la Tienda (`getCatalogoDisponibleAction`).
- UI: campana en `aside.tsx` (escritorio) y en el header móvil de `dashboard-client.tsx`; drawer lateral en `app/administrar/notificaciones.tsx` con buscador (sin tildes), filtro por tipo (sin filtro de origen: se muestran todos), color por tipo, eliminar una y "Limpiar todo" (confirmación en línea; `clearNotificacionesAction` hace soft-delete de todas hasta el id más nuevo cargado, así no borra lo que llegue mientras se confirma). Lee las 100 más recientes al cargar y al abrir (sin realtime).
- Check ejecutable (RLS + dedupe; corre en una transacción con ROLLBACK y no deja filas): `supabase db query --linked -f supabase/checks/notificacion_check.sql`.

## 19) Inventario a demanda del proveedor

`.claude/agents/inventario-proveedores.md` — agente que, a pedido explícito del usuario ("dame el inventario", "qué están vendiendo", "revisa la tienda"), hace login en tuproveedor2.com (`agent-browser` CLI por Bash, nunca las tools MCP aunque estén cargadas), pagina `/tienda`, parsea productos y agotados del texto de `read`, clasifica por tipo de servicio y por Completa/Pantalla, y escribe/actualiza un único `.md` por plataforma en `C:\Users\user\Documents\Bobeda de Larry\Informe de productos\inventario-<plataforma>.md` (nunca dentro del repo). Es de solo lectura: nunca compra ni agrega al carrito (eso es `comprar-proveedor`, sección 16). Credenciales en `.env.platform` (mismo archivo que usa `comprar-proveedor`). Antes provenía de un repo separado (`analisis-plataformas`, eliminado el 2026-09-20) — ahora vive acá junto con el resto del flujo del proveedor (`comprar-proveedor` y `stock-price-watch`). Si la estructura del sitio cambia (login, paginación, marcador "Agotado"), el agente para y avisa en vez de asumir.

## 20) Bodega (compras al proveedor con el saldo de su monedero)

Detalle completo en `app/lib/bodega/CLAUDE.md` (se carga solo al trabajar en esa carpeta): alcance solo-compra, el sitio del proveedor, guardas de `comprar()`, DB, registro de compras, `BODEGA_SIMULAR` y verificación sin gastar.

- Job nocturno del registro de compras: `jobs/historial-proveedor/` (servicio cron de Railway, `0 5 * * *` UTC = 00:00 Colombia; Node puro empaquetado con esbuild, sin Next). Variables y pasos de alta en su `README.md`. `jobs/**/dist/` está ignorado por git y por eslint.
