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

`supabase/functions/stock-price-watch/` escanea tuproveedor2.com **sin navegador ni LLM** (login WordPress/Ultimate Member en `/login/` + paginación de `/tienda/` por HTTP plano) y sincroniza `business.*`: una fila en `extraction_run`, un `market_listing_snapshot` por producto y un `market_alert` por cada cambio (agotado / volvió stock / precio). No envía WhatsApp. Productos nuevos se insertan solos en `market_listing` (plataforma deducida por nombre; combos y no reconocidos quedan con `platform_id` null).

- Cron: pg_cron job `stock-price-watch`, `*/30 * * * *` UTC (cada 30 min, en el :00 y el :30; 48 corridas al día; Colombia = UTC-5), creado por la migración `20260920120005_stock_watch_cron.sql` (originalmente cada 6 h) y cambiado a 30 min por `20260920170001_stock_watch_cron_30min.sql`. Llama a la función con pg_net y el header `x-cron-secret`.
- Secrets de la función: `PLATFORM_URL`, `PLATFORM_STORE_PATH`, `PLATFORM_EMAIL`, `PLATFORM_PASSWORD`, `CRON_SECRET`. `CRON_SECRET` debe ser idéntico al secret `cron_secret` de Vault (si se rota uno, rotar el otro).
- Desplegar siempre con `supabase functions deploy stock-price-watch --no-verify-jwt --project-ref tnwcnpzjlpophcqnqrxb`; sin `--no-verify-jwt` el cron recibe 401.
- Identidad de producto = `clave()` en `lib.ts` (ignora mayúsculas, prefijo `z ` de combos, espacios y signos): el sitio y el seed difieren en eso. `lib.ts` es solo `fetch` + regex para poder probarlo fuera de Deno: `node supabase/functions/stock-price-watch/lib_test.ts`.
- La función aborta sin escribir si el login falla, si los productos parseados no igualan el total publicado, o si el catálogo cae a menos de la mitad de la corrida anterior.
- `market_alert.enviado_at` significa "momento de detección" (no hay envío). `extraction_run.created_at` guarda la hora del escaneo desde la migración `20260927210001` (las corridas anteriores quedan en NULL, solo con `fecha_extraccion`).
- Operación (ver estado, correr ya, pausar, cambiar horario): `Bobeda de Larry/Informe de productos/manual-tarea-diaria.md`.
- Si una corrida falla (login, parseo, guardas, DB) deja un aviso `error` en la bandeja de notificaciones (sección 18). `?dry=1` nunca avisa.

## 18) Notificaciones (campana + bandeja `business.notificacion`)

Bandeja de avisos **importantes** para admin/manager: fallas y advertencias del scraping y de la plataforma. No es un log ni el historial de stock/precio (eso es `market_alert`). Migraciones `20260920150001_notificacion.sql` y `20260920160001_notificacion_tipos_info_exito.sql`.

- Tabla `business.notificacion`: `origen` (`scraping` | `plataforma`), `tipo` (`error` rojo | `advertencia` ámbar | `info` azul "Novedad" | `exito` verde "Disponible"; define color e icono), `titulo`, `mensaje`, `exist`, `created_at`. "Eliminar" = `exist=false` (soft-delete global, no por usuario): la fila queda en la DB y la UI no la muestra. Nadie hace DELETE ni INSERT directo (sin privilegio).
- RLS: solo admin/manager leen y descartan (el rol `user` no ve nada). Único UPDATE permitido: `exist=false`.
- Crear avisos siempre con `business.notificar(p_origen, p_tipo, p_titulo, p_mensaje)` (security definer; solo inserta si llama staff o service_role, para un cliente no hace nada): desde Next con `notificar()` de `app/lib/notify.ts` (nunca lanza; usa la clave secreta si está, así avisa aunque la falla ocurra en una acción de cliente), desde la Edge Function con `db.rpc("notificar", …)`. Descarta el aviso si ya hay uno idéntico (mismos 4 campos) sin eliminar, así una falla persistente no se acumula; si se elimina y la falla sigue, vuelve a avisar.
- Hoy emiten: `stock-price-watch` (corrida fallida, y los cambios del catálogo del proveedor en cada corrida: `advertencia` se agotó / `exito` volvió el stock (por producto = plataforma + Completa/Pantalla, hay stock si algún listing está disponible; los combos y no reconocidos cuentan cada uno por separado) y `info` productos nuevos; un aviso por tipo y corrida, nunca en la primera corrida; el detalle de todo cambio sigue en `market_alert`), el scraper de licencias de la app (`getLicenciasDisponiblesAction`, `createProductoAction`) y la Tienda (`getCatalogoDisponibleAction`).
- UI: campana en `aside.tsx` (escritorio) y en el header móvil de `dashboard-client.tsx`; drawer lateral en `app/administrar/notificaciones.tsx` con buscador (sin tildes), filtros por tipo y origen, color por tipo y eliminar. Lee las 100 más recientes al cargar y al abrir (sin realtime).
- Check ejecutable (RLS + dedupe; corre en una transacción con ROLLBACK y no deja filas): `supabase db query --linked -f supabase/checks/notificacion_check.sql`.

## 19) Inventario a demanda del proveedor

`.claude/agents/inventario-proveedores.md` — agente que, a pedido explícito del usuario ("dame el inventario", "qué están vendiendo", "revisa la tienda"), hace login en tuproveedor2.com (`agent-browser` CLI por Bash, nunca las tools MCP aunque estén cargadas), pagina `/tienda`, parsea productos y agotados del texto de `read`, clasifica por tipo de servicio y por Completa/Pantalla, y escribe/actualiza un único `.md` por plataforma en `C:\Users\user\Documents\Bobeda de Larry\Informe de productos\inventario-<plataforma>.md` (nunca dentro del repo). Es de solo lectura: nunca compra ni agrega al carrito (eso es `comprar-proveedor`, sección 16). Credenciales en `.env.platform` (mismo archivo que usa `comprar-proveedor`). Antes provenía de un repo separado (`analisis-plataformas`, eliminado el 2026-09-20) — ahora vive acá junto con el resto del flujo del proveedor (`comprar-proveedor` y `stock-price-watch`). Si la estructura del sitio cambia (login, paginación, marcador "Agotado"), el agente para y avisa en vez de asumir.

## 20) Bodega (compras al proveedor con el saldo de su monedero)

`/administrar/bodega`, **solo admin/manager** (el rol `user` es redirigido y las server actions lo rechazan; RLS de `compra_proveedor` también). Muestra el **saldo real** del monedero (se lee de `/mi-cuenta/my-wallet/` en cada carga, nunca se guarda en la DB), los productos que el último escaneo del cron vio **en stock** (`market_listing_snapshot` del `extraction_run` más reciente) y permite **comprarlos**. Solo compra: la compra queda `pagada` con su número de pedido y aparece en el registro de compras; **no registra nada en el inventario** (decisión del usuario 2026-09-27: sin flujos de registro, botón «Registrar» ni estados de entrega). Misma tabla que Clientes (`app/ui/table.tsx`, que ganó las props opcionales `hideCreate`, `builtinActions` y `extraActions`).

- Código: `app/lib/bodega/` (`entrega.ts` parseo puro de credenciales, lo usa Perfiles para la clave vigente · `proveedor.ts` cliente HTTP del sitio · `compra.ts` orquestador con todas las guardas · `db.ts` adaptador Supabase · `tipos.ts`/`schema.ts`), acciones en `app/action/manager-and-admin/bodega/`, UI en `app/administrar/bodega/`. `compra.ts` no importa Next ni supabase-js (todo entra por `deps`), así se prueba entero contra un proveedor simulado.
- El sitio (verificado a mano el 2026-09-20): WooCommerce + TeraWallet. Único medio de pago = `wallet`. Buscar por nombre con un solo resultado **redirige (302) a la ficha**; la ficha trae el `id` (`name="add-to-cart"`), el precio y el stock máximo (`max` del input de cantidad). Agregar = `GET /tienda/?add-to-cart=ID&quantity=N`; el pedido se envía con `POST /?wc-ajax=checkout` (JSON `{result, redirect}`); el pedido queda "Completado" al instante y la entrega aparece en `/mi-cuenta/view-license-keys/` con el número de pedido de cada licencia. **El carrito es uno solo por cuenta y persistente.**
- Guardas de `comprar()` (gasta plata real; ante la duda no paga): rol en el servidor · cantidad 1..`MAX_CANTIDAD`(10) · login en frío y producto/precio/stock/saldo **en vivo** (el precio que el manager confirmó debe ser el de ahora) · `iniciar_compra` (idempotencia por `request_id` + candado global: una sola compra `iniciada` a la vez) · el carrito debe estar **vacío** (no se toca lo ajeno) · el checkout debe mostrar exactamente ese ítem/cantidad/total, pago `wallet`, saldo suficiente y **ningún campo obligatorio extra** · máx. 60 s antes de pagar. Pago OK ⇒ `pagada` (estado final). Rechazo explícito del proveedor ⇒ `fallida`; respuesta dudosa (timeout, HTML) ⇒ `incierta` y **nunca se reintenta** el pago. Un error posterior al pago jamás se presenta como "no se pagó".
- DB (migración `20260920190001_bodega.sql`): `business.compra_proveedor` (estados `iniciada|pagada|fallida|incierta` — `registrada`/`pendiente_registro` siguen en el enum pero Bodega ya no los usa; nadie escribe directo, solo `iniciar_compra`/`actualizar_compra`, `security definer` que exigen admin/manager con `business.es_staff()`). `registrar_licencias` (ya no la usa Bodega, solo `createProductoAction` en Productos) es atómica (todo o nada), cifra la clave (`pgp_sym_encrypt`, `ACCOUNT_ENC_KEY`), **no duplica** (clave natural plataforma+correo+perfil+vencimiento) y crea el `producto` que falte **sin `precio_venta`** (no sale en la Tienda hasta fijarlo en Productos; si estaba eliminado se revive también sin precio). `createProductoAction` usa la misma función (antes insertaba `profile.precio_venta`, columna que ya no existe, y no revisaba el error).
- Registro de compras (arriba, junto a saldo y resumen): es **global**, todos los pedidos de la cuenta del proveedor (desde Bodega o a mano en el sitio), leídos en vivo por `getPedidosProveedorAction` → `leerPedidos()` (pagina `/mi-cuenta/orders/` y cruza con "Mis licencias" para saber los productos de cada pedido; no se guarda en la DB). Las compras fallidas/simuladas ya no se listan (no son pedidos); una `incierta` que sí se pagó aparece como pedido y además avisa en la campana. El Resumen muestra, en ese orden, gastado este mes, pedidos este mes (hora de Colombia, sin fallidos/cancelados/reembolsados) y disponibles para comprar.
- Catálogo disponible: columna **Duración** leída del nombre del producto (`duracionDe()` en `app/lib/bodega/duracion.ts`: "3 MESES", "X2 MESES", "1 AÑO", "33 DIAS", "30 CREDITOS"; sin duración en el nombre = "1 mes", lo que duraron las cuentas ya entregadas) y filtros por plataforma y rango de precio fijo (`filtros-catalogo.tsx`, prop `filters` de la tabla genérica; cada opción lleva su conteo en una pastilla, `count` de `SelectDropdown`).
- `BODEGA_SIMULAR=1` en el servidor (no lo controla el cliente): ejecuta todo el flujo contra el sitio real y **se detiene justo antes de pagar** (quita lo agregado; la compra queda `fallida` "Simulación"). Sirve para ensayar sin gastar.
- Verificación sin gastar: `supabase db query --linked -f supabase/checks/bodega_check.sql` (permisos, idempotencia, candado, estados, registro; ROLLBACK, no deja filas; correrlo tras aplicar la migración). El flujo se probó contra un proveedor simulado con el marcado real (pago, rechazo, respuesta rota, doble envío, carrito ajeno, entrega tardía/irreconocible…) y las guardas de `comprar()` con mutation testing. **El POST de pago con dinero real nunca se ejecutó desde código**: la primera compra real la hace el manager desde el módulo.

