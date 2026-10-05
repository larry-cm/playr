# Chat inbox: tags, folders, message interactions, details panel, unread badges

Locator: `odd/tasks/chat-bandeja.md` · Engram mirror: `odd/chat-bandeja/tasks`
Branch: `feature/chat-bandeja` (from `develop` 305f631) · Worktree: `.claude/worktrees/chat-bandeja`

## Objective
Turn `/administrar/mensajes` into a WhatsApp/Telegram-grade business inbox: labels per client with filters, folders (full CRUD), reply/react/pin messages (staff and client), per-chat details panel, pin/archive/delete chats, and live unread counts (sidebar badge + per chat).

## Problem
- A "chat" is only a `cliente_id` grouping of `business.mensaje_asesor`; no per-chat state table (`mensajes-action.ts` groups the last 2000 messages in JS).
- No labels, folders, pinned/archived/deleted chats, reply/reaction/pin on messages, details panel; sidebar `Mensajes` item has no unread badge (`aside.tsx` navItems static).
- `authenticated` can only SELECT `mensaje_asesor`; every write is a security-definer RPC.

## Why
User request 2026-10-04 ("Dale mas vida al modulo de mensajes"). Decisions (2026-10-04, AskUserQuestion):
- Delete chat = staff-only (like WhatsApp "delete chat"): hidden for staff up to that point; client keeps history; new client messages bring it back with only new ones.
- Client also sees and uses reply/react/pin in "Chat con el asesor".
- Labels, folders, pins, archive are shared by all staff (one business inbox, like `leido` today).

Reference behavior (research 2026-10-04): WhatsApp Business labels (≤20, colors, several per chat, filter by label); Telegram folders (≤10, ≤100 chats each, tabs); archived chats pop back on a new message (Telegram); pinned chats ≤5 (Telegram main list); pinned messages ≤3 per chat, oldest replaced (WhatsApp); one reaction per person per message (WhatsApp).

## Scope (authorized)
- DB: labels, chat↔label, folders, folder↔chat, per-chat state (pinned, archived, deleted-up-to, manual unread, internal notes), reactions, `responde_a` + pinned on messages, unread count RPC, inbox summary RPC, Telegram reply mapping.
- Server actions + Zod validation; Telegram quoting of replies (out) and reply mapping (in, topic replies to a mirrored message).
- UI staff: list with folder tabs, label filter, unread/archived views, chat menu, label & folder managers (CRUD), details panel; thread with reply/react/pin + pinned banner.
- UI client: reply/react/pin in `chat-asesor.tsx`.
- Sidebar + mobile unread badge for staff.
- Out: Telegram reactions/pins sync (needs `message_reaction` updates), per-staff private folders, realtime (stays polling), message edit/delete.

## Constraints
- Shared prod DB (local = prod). Migration validated in PGlite sandbox before `db push`; push only with explicit user OK.
- Migration version `20261005120001` (> remote latest 20261005100006, checked with `migration list --linked`).
- Conventions: security definer + `set search_path = ''`, `es_staff()` guard 42501, user errors 22023, revoke public/anon; actions start with `esStaff()`; Spanish UI; `@ui/@lib/@action` aliases; skeleton = same component with undefined data.
- ~400 authored lines per task is advisory only.

## Tasks
- [x] T1 — DB migration `supabase/migrations/20261005120001_chat_bandeja.sql` + `supabase/checks/chat_bandeja_check.sql`, validated in PGlite sandbox (positive + mutation). Route: delegated (writer, preparation). Risk: high.
- [x] T2 — Server actions + `app/lib/chat-bandeja.ts` (Zod mirrors DB rules; planned as `chat-schema.ts`) + inbox/unread actions + Telegram reply quoting/mapping. Route: delegated (writer 2+ files). Risk: high.
- [x] T3 — Message interactions UI: shared bubble/actions component, reply chip, reactions, pin + pinned banner, in staff thread and client chat. Route: delegated (writer). Risk: medium.
- [x] T4 — Inbox UI: folder tabs, label filter, unread/archived views, chat menu (pin/archive/unread/delete), label & folder managers (CRUD), details panel. Route: delegated (writer). Risk: medium.
- [x] T5 — Staff unread badge on sidebar Mensajes item + mobile header. Route: delegated with T4 or inline. Risk: medium.
- [x] T6 — Apply migration to prod (user OK) + run check; CLAUDE.md §21 docs; lint/tsc/build; browser check. Route: inline + supabase-admin. Risk: high.

## Acceptance criteria
1. `supabase db query --linked -f supabase/checks/chat_bandeja_check.sql` → `chat_bandeja_check: OK` (and in PGlite sandbox before push).
2. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` pass.
3. Staff can create/edit/delete labels (≤20, unique name, palette color) and folders (≤10, unique name, ≤100 chats), assign them, and filter the list by them.
4. Staff and client can reply (quote shown, click jumps), react (one per side, toggle), pin (≤3, oldest replaced) messages.
5. Pin (≤5)/archive/unarchive/mark-unread/delete chat work; a new client message unarchives and brings back a deleted chat.
6. Sidebar Mensajes badge shows total unread client messages and drops after opening the chat; per-chat count matches unread messages.

## Checks
- TDD: off — source: project has no test suite (CLAUDE.md §12/§13) — runner: n/a; SQL behavior proven by the check script (PGlite sandbox, then prod with ROLLBACK).
- `pnpm lint` · `pnpm exec tsc --noEmit` · `pnpm build` (worktree has its own `.next`).

## Progress / Evidence
- T1 (2026-10-04): `supabase/migrations/20261005120001_chat_bandeja.sql` + `supabase/checks/chat_bandeja_check.sql`. Not applied to prod.
  - PGlite sandbox (scratchpad `pglite/run.mjs`): all 37 repo migrations applied in order (skipped only the 2 pg_cron/pg_net ones: `20260920120005_stock_watch_cron.sql`, `20260920170001_stock_watch_cron_30min.sql`; stubs: auth.users/uid/jwt/role, storage.buckets/objects/foldername, vault.decrypted_secrets, `main.client` + `main.trg_limit_profiles_per_account()`, pgcrypto in `extensions`, Supabase-like global default privileges) + seed (admin, 2 users, 5 extra clients, one pre-pinned, one pre-archived, 1 existing label/folder) → `chat_bandeja_check: OK`, 0 residual rows.
  - Regression: existing `chat_cuota_check.sql` OK; `chat_asesor_check.sql` OK after patching (in a scratch copy) its stale `leer/guardar_licencias_cache` calls (stale since `20261005100006_enc_key_vault.sql`, unrelated to T1).
  - Mutation testing: 19/19 mutations make the check fail (label/folder/pin/100-per-folder limits, es_staff guard in `chat_fijar`, responde_a trigger, client/staff responde_a validation, pin rotation, deleted chat in inbox, unarchive trigger, reaction RLS and authorization, manual-unread counting and reset, case-insensitive duplicate, direct-write grants, delete removes folders, reorder full-set validation).

- T2 (2026-10-04): `app/lib/chat-bandeja.ts`, `app/action/manager-and-admin/mensajes/{mensajes,etiquetas,carpetas,estado}-action.ts` + `rpc-staff.ts`, `app/action/chat-mensaje-action.ts`, `app/action/tienda/chat-asesor-action.ts`, `app/lib/telegram.ts`, `app/api/telegram/route.ts`; compat only in `app/administrar/mensajes/page.tsx`. Not run against the DB (prod).
  - `pnpm exec tsc --noEmit` → clean (after `pnpm exec next typegen`: the worktree had no `next-env.d.ts`, which made `aside.tsx`'s svg import fail). `pnpm lint` → clean.
  - Scratch `chat-bandeja-schemas.test.mjs` (esbuild bundle of `chat-bandeja.ts`) → 32/32 PASS: rejects empty/31-char label, 25-char folder, 9-char icon, bad color, duplicate label/folder/chat ids, 101 chats, emoji outside the set, 1001-char notes, bad uuid; normalizes `"  Hola   mundo "` → `"Hola mundo"`, `#3987E5 ` → `#3987e5`, `❤` → `❤️`, blank icon/notes → null; counts emoji as 1 char (char_length).
- T3 (2026-10-04): new `app/ui/chat-burbuja.tsx` (ChatBurbuja + floating MenuMensaje in a portal + ChipRespuesta + `useIrAMensaje` + `useInteraccionesMensaje` optimistic hook with rollback and `conPendientes` re-applied over polling results) and `app/ui/chat-fijados.tsx` (Telegram-style pinned banner, h-12); `ChatCompositor` gains `focusKey` and always calls the latest `onEnviar` (ref); wired into `ChatCliente` (`mensajes-client.tsx`) and `chat-asesor.tsx`. Not run against the DB.
  - `pnpm exec tsc --noEmit` → clean · `pnpm lint` → clean · `pnpm build` → OK (with a temporary preview page, since deleted).
  - Visual check (temporary `/preview-chat-t3` with fake props, `next start -p 3100`, agent-browser; page deleted, server stopped): desktop hover toolbar (react/reply/⋯), menu with 6 reactions + Responder/Desfijar/Copiar texto (focus on first emoji, Esc closes and returns focus to ⋯), quote + "Mensaje eliminado", grouped reaction chips with own highlighted, pin marks, banner click → highlight + "2 de 2"; at 390 px no horizontal overflow (fixed via `[contain:inline-size]` on truncated quote/banner/chip text).
  - Not verified: real touch long-press (emulator kept `hover:hover`), real actions/polling (T6).
- T4 (2026-10-04): `app/administrar/mensajes/` split into `mensajes-client.tsx` (state + provider + layout), `bandeja-contexto.tsx` (`BandejaProvider`/`useBandeja`: `useOptimistic` chats, chat actions with inline errors by origin, `EVENTO_SIN_LEER` after read/unread/delete, `router.refresh()` after success), `bandeja-util.ts` (pure sort/filter/short time), `filtros-bandeja.tsx` (search + label filter chips + gear popover + Telegram-style tablist: Todos / folders with unread-chat counts / No leídos; archived view header), `lista-chats.tsx` (rows: avatar, bold unread, pin, `Tú: `, short time, exact `sinLeer` pill or manual-unread dot, ≤2 label chips + "+N"; ⋯ on hover/focus, right-click and 450 ms long-press), `menu-chat.tsx` (pin with reason / archive / read-unread / label + folder checklists / delete with the agreed text), `checklist-asignar.tsx`, `gestor-etiquetas.tsx` + `gestor-carpetas.tsx` + `gestor-comun.tsx` (Modal CRUD, Zod `safeParse` + case-insensitive duplicate + live length counters, `N de 20/10/100`, radiogroup palette, inline delete confirm, reorder ↑/↓ with `useOptimistic`, "Elegir chats" view), `panel-detalles.tsx` (client data + copy, switches, labels/folders, notes ≤1000, pinned messages → jump, orders moved from the old `<details>`, delete zone), `chat-cliente.tsx` (thread moved out; Info + Pedidos header buttons; panel = full sheet on mobile, right drawer on lg, 3rd column on xl). New generic `app/ui/popover.tsx` (portal, follows anchor, Esc with preventDefault, outside click, ↑/↓ nav, focus return). `page.tsx`/`loading.tsx` pass `Bandeja`/undefined. Not run against the DB.
  - `pnpm lint` → clean · `pnpm exec tsc --noEmit` → clean · `pnpm build` → OK (with and after removing a temporary `/preview-bandeja` page with mock props, served by `next start -p 3100`, screenshots with agent-browser; page deleted, server stopped).
  - Seen: 1440 list (pinned first, archived entry, chips, pills/dot), ⋯ menu + folder checklist (full folder disabled "Llena (100)"), Esc returns focus to ⋯; label manager with normalized duplicate error and 11/30 counter, inline delete confirm (first Esc cancels confirm, second closes modal); folder manager + "Elegir chats" (3 de 100; Esc returns to folders); label filter; archived view; loading skeleton (same frame); panel at 1440 and 390; 390 list + right-click menu with no horizontal scroll (fixed an sr-only overflow in tabs).
  - Not verified: real actions/optimistic rollback against the DB, long-press on a real touch device, chat thread + panel together with live data (T6).
- T5 (2026-10-04): new `app/administrar/use-mensajes-sin-leer.ts` (`useMensajesSinLeer(enabled)`: 15 s poll only while visible, recount on visible / pathname change / `EVENTO_SIN_LEER` debounced 300 ms + `BroadcastChannel("playr-chat-sin-leer")` to other tabs, sequence guard for stale replies, off for role `user`); `aside.tsx` gets `badges` prop + exported `Insignia` pill (99+ cap, icon corner in rail mode, right of label otherwise, link `aria-label` "Mensajes, N sin leer"); `dashboard-client.tsx` passes the count and shows it on the mobile menu button ("Abrir menú, N mensajes sin leer"). `pnpm lint` → clean · `pnpm exec tsc --noEmit` → clean. Not run against the DB nor in a browser (T6).
- T6 browser E2E (2026-10-04, `next dev -p 3100` in the worktree, test Telegram bot, prod DB with a temporary admin + client, agent-browser `--session admin` / `--session cliente`; screenshots in scratchpad `e2e/`): all 11 checks PASS — badge 3 on sidebar and mobile menu button within ~15 s, row "Sin leer: 3"; opening clears both in ~3 s; reply quote both sides + jump/highlight; reactions grouped (❤️ 2), toggle off, replace 👍→❤️; 4 pins → "Mensaje fijado 1 de 3", oldest rotated, unpin, client sees banner; label/folder CRUD + validation (empty, 31/25 chars, case-insensitive duplicate incl. on rename), assign, filter, reorder, "Elegir chats", tab count, delete ("Se quita de 1 chat"); pin/archive (unpins) → client message unarchives; manual unread dot + badge; details panel (notes 1001/1000 blocked, survive reload; pinned jump; delete → client keeps history, new message brings chat back with only it, unread 1, labels/notes kept, folders and old pins gone); 390 px list/chat/panel `scrollWidth` 390; no browser console errors.
  - Fix: `app/administrar/mensajes/lista-chats.tsx` — on `hover:none` the row ⋯ was `hidden` (long-press only); now visible at 60% opacity without background, and the time shifts left of it (`[@media(hover:none)]:mr-6`). Verified with CDP touch emulation (`hover: none` true): ⋯ visible, menu opens, no overlap with the unread dot.
  - `pnpm lint` → clean · `pnpm exec tsc --noEmit` → clean · `pnpm build` → OK. Cleanup: E2E users/messages/reactions/hilos/tema/labels/folders/state deleted; residual counts 0; labels/folders/state/reactions back to baseline (0/0/0/0), messages 12 = baseline.

- T6: migration pushed to prod 2026-10-04 (dry-run showed only 20261005120001); `chat_bandeja_check.sql` in prod → OK (ROLLBACK, 0 residual rows); CLAUDE.md §21 updated; E2E 11/11 PASS (see above).

## Review ledger
- WU1 (T1+T2): base 58b68ef → candidate 6918a7c, risk medium (executable_change), lens risk, consent granted; findings: none; ack approved.
- WU2 (T3–T6): base 6918a7c → candidate 2b90501, risk medium (executable_change), lens reliability, consent granted; findings: RELIABILITY-001 WARNING pre-existing (no JS unit-test runner; pure logic in bandeja-util/chat-burbuja untested) → info/follow-up; ack approved.

## Delivery
Actual: ~6200 authored lines (2 reviewed work units). Strategy: ask-on-risk; commits on `feature/chat-bandeja` after user approval, merge to develop with --no-ff.

## Next step
User approval → commit(s) → merge into develop. Follow-ups: JS unit tests for bandeja-util/chat-burbuja logic; stale `supabase/checks/chat_asesor_check.sql` (licencias_cache signatures since 20261005100006); test Telegram group keeps the E2E forum topic.

## Contract T1
All functions: `security definer`, `set search_path = ''`, EXECUTE only for `authenticated` (revoked from public/anon). Staff functions start with `es_staff()` → `42501 'sin permiso'`. User-facing errors: errcode `22023` (Spanish message, show as is). Tables: RLS on, `authenticated` and `service_role` have SELECT only; no INSERT/UPDATE/DELETE for `authenticated` (writes only through the RPCs).

### Tables / columns
- `business.chat_etiqueta(id bigint identity pk, nombre text 1..30 trimmed, color text, created_at)`; unique `lower(nombre)`. Palette (lowercase): `#3987e5 #d95926 #199e70 #c98500 #d55181 #008300 #9085e9 #e5484d #0ea5e9 #a855f7`. Max 20. RLS select: staff.
- `business.chat_cliente_etiqueta(cliente_id uuid → auth.users cascade, etiqueta_id → chat_etiqueta cascade, created_at, pk(cliente_id, etiqueta_id))`. RLS select: staff.
- `business.chat_carpeta(id bigint identity pk, nombre text 1..24 trimmed, icono text null 1..8 chars, orden int 0..n-1 (unique, deferrable), created_at, updated_at)`; unique `lower(nombre)`. Max 10. RLS select: staff.
- `business.chat_carpeta_cliente(carpeta_id → chat_carpeta cascade, cliente_id uuid → auth.users cascade, created_at, pk(carpeta_id, cliente_id))`. Max 100 per folder; a chat may be in several. RLS select: staff.
- `business.chat_estado(cliente_id uuid pk → auth.users cascade, fijado_en timestamptz, archivado_en timestamptz, eliminado_hasta bigint, no_leido_manual bool default false, notas text null 1..1000, updated_at)`; check: not pinned and archived at once. Row may be missing (= all defaults). Staff sees only messages with `id > coalesce(eliminado_hasta, 0)`. RLS select: staff (client never sees it).
- `business.mensaje_reaccion(mensaje_id → mensaje_asesor cascade, user_id uuid → auth.users cascade, autor 'cliente'|'asesor', emoji in 👍 ❤️ 😂 😮 😢 🙏, created_at, pk(mensaje_id, user_id))`. RLS select: staff, or the message is in the caller's own chat.
- `business.mensaje_asesor` + `responde_a bigint null → mensaje_asesor(id) on delete set null` + `fijado_en timestamptz null`. Constraint trigger (also covers the webhook's direct service_role insert/update): `responde_a` must be a message of the same `cliente_id`, else `23514 'La respuesta debe ser a un mensaje del mismo chat.'`. Max 3 pinned per chat (shared by client and staff).
- `business.telegram_hilo` + `mensaje_id bigint null → mensaje_asesor(id) on delete set null` (indexed): the Playr message a Telegram message mirrors. service_role keeps SELECT, INSERT (no UPDATE).
- Trigger: every insert of a `autor='cliente'` message clears `chat_estado.archivado_en` (a deleted chat reappears by itself because its new id > `eliminado_hasta`). Messages from the advisor never unarchive.
- Name normalization (labels and folders): runs of whitespace (incl. newlines) → one space, then trimmed (`regexp_replace(x, '\s+', ' ', 'g')` + `btrim`). Zod must mirror this before measuring length.

### Staff RPCs (all `22023` unless noted)
- `chat_etiqueta_guardar(p_id bigint, p_nombre text, p_color text) → bigint` (p_id null = create). Errors: `Escribe el nombre de la etiqueta.` · `El nombre de la etiqueta es muy largo (máximo 30 caracteres).` · `Elige un color de la lista.` (color is trimmed + lowercased first) · `Ya existe una etiqueta con ese nombre.` (case-insensitive) · `Máximo 20 etiquetas.` · `Etiqueta no encontrada.`
- `chat_etiqueta_eliminar(p_id bigint) → void` (removes it from all chats). `Etiqueta no encontrada.`
- `chat_etiquetas_asignar(p_cliente_id uuid, p_etiquetas bigint[]) → void` — exact set (null/empty = none). `Cliente no encontrado.` (not in security.client) · `La lista de etiquetas no es válida.` (null element or duplicates) · `Etiqueta no encontrada.`
- `chat_carpeta_guardar(p_id bigint, p_nombre text, p_icono text) → bigint` (create appends at the end; icono trimmed, empty = null). `Escribe el nombre de la carpeta.` · `El nombre de la carpeta es muy largo (máximo 24 caracteres).` · `El icono no es válido.` (> 8 chars) · `Ya existe una carpeta con ese nombre.` · `Máximo 10 carpetas.` · `Carpeta no encontrada.`
- `chat_carpeta_eliminar(p_id bigint) → void` (chats stay, membership goes, `orden` re-compacted). `Carpeta no encontrada.`
- `chat_carpetas_ordenar(p_ids bigint[]) → void` — must be exactly all folder ids once each, in the new order. `La lista de carpetas no coincide. Recarga la página.`
- `chat_carpeta_chats(p_carpeta_id bigint, p_clientes uuid[]) → void` — exact members. `La lista de chats no es válida.` · `Máximo 100 chats por carpeta.` · `Carpeta no encontrada.` · `Cliente no encontrado.`
- `chat_carpetas_de_cliente(p_cliente_id uuid, p_carpetas bigint[]) → void` — exact folders of one chat. `Cliente no encontrado.` · `La lista de carpetas no es válida.` · `Carpeta no encontrada.` · `La carpeta "<nombre>" ya tiene 100 chats.`
- `chat_fijar(p_cliente_id uuid, p_fijar boolean) → void` — idempotent. `Cliente no encontrado.` · `Desarchiva el chat antes de fijarlo.` · `Máximo 5 chats fijados.`
- `chat_archivar(p_cliente_id uuid, p_archivar boolean) → void` — archiving also unpins. `Cliente no encontrado.`
- `chat_eliminar(p_cliente_id uuid) → void` — sets `eliminado_hasta = max(id)` of the chat, marks those client messages `leido`, clears pin/archive/manual-unread, removes folder memberships; keeps labels and notes; does not touch message pins/reactions (filter them by visibility in the UI). `Cliente no encontrado.` · `El chat no tiene mensajes.`
- `chat_marcar_no_leido(p_cliente_id uuid, p_no_leido boolean) → void`. `Cliente no encontrado.`
- `chat_notas_guardar(p_cliente_id uuid, p_notas text) → void` (trimmed; empty = null). `Las notas son muy largas (máximo 1000 caracteres).` · `Cliente no encontrado.`
- `marcar_leidos_staff(p_cliente_id uuid) → void` (same signature) now also sets `no_leido_manual = false`.
- `enviar_mensaje_staff(p_cliente_id uuid, p_texto text, p_via text default 'panel', p_adjunto_path text default null, p_adjunto_tipo text default null, p_responde_a bigint default null) → bigint` — old 5-arg signature dropped. New error: `El mensaje que respondes no existe.` (not in this chat or hidden by a delete). Other validations unchanged.
- `chat_bandeja_staff() → table(cliente_id uuid, username text, email text, phone text, ultimo_id bigint, ultimo_texto text, ultimo_autor text, ultimo_adjunto_tipo text, ultimo_created_at timestamptz, sin_leer int, fijado_en timestamptz, archivado_en timestamptz, no_leido_manual boolean, etiquetas bigint[], carpetas bigint[])` — one row per user with ≥1 visible message, ordered by `ultimo_id desc` (UI sorts pinned first). username/phone null if no security.client row; email falls back to auth.users. `sin_leer` = visible client messages not read; arrays sorted, `'{}'` when none. Includes archived chats (UI filters by `archivado_en`).
- `chat_sin_leer_staff() → int` — visible unread client messages in all chats (archived included) + 1 per chat with `no_leido_manual` and no real unread.

### Staff or the chat's own client
- `mensaje_reaccionar(p_mensaje_id bigint, p_emoji text) → text` — resulting emoji or null. Null or the same emoji removes; another replaces. `❤` is normalized to `❤️`. Errors: `42501 'sin permiso'` (client, message of another chat or nonexistent), `42501 'sin sesión'`, `Mensaje no encontrado.` (staff: nonexistent or hidden by a delete), `Reacción no válida.` Row `autor` = 'asesor' for staff, 'cliente' for the owner.
- `mensaje_fijar(p_mensaje_id bigint, p_fijar boolean) → void` — idempotent; pinning a 4th unpins the oldest pinned (by `fijado_en`, uses `clock_timestamp()`). Same errors/authorization as above.
- `enviar_mensaje_asesor(p_texto text, p_pedido_id bigint default null, p_adjunto_path text default null, p_adjunto_tipo text default null, p_responde_a bigint default null) → bigint` (client) — old 4-arg signature dropped. New error: `El mensaje que respondes no existe.` (not a message of the caller's chat; the client may reply to any of its own messages, even those the staff deleted). Rate limit and other validations unchanged.

### Reads without RPC
- Staff: `chat_etiqueta`, `chat_carpeta` (order by `orden`), `chat_estado` (notes for the details panel), `mensaje_reaccion`, `mensaje_asesor.responde_a/fijado_en` via PostgREST. The staff thread query must add `id > eliminado_hasta` itself (RLS does not hide deleted messages from staff).
- Client: own `mensaje_asesor` (incl. `responde_a`, `fijado_en`) and `mensaje_reaccion` of its chat.

## Contract T2
Every action returns `Resultado<T> = ({ ok: true } & T) | { ok: false; error: string }` (Spanish `error`, show as is) unless noted. Staff actions: `esStaff()` first (else `SIN_PERMISO`), Zod validation before the RPC (same messages as the DB), RPC `22023` → DB message, `42501` → `SIN_PERMISO`, other → generic. Successful staff mutations call `revalidatePath("/administrar/mensajes")` (the page re-renders with the new `Bandeja`).

### `@lib/chat-bandeja` (shared, client-safe; no "use server")
- Constants: `ETIQUETA_MAX=20`, `ETIQUETA_NOMBRE_MAX=30`, `CARPETA_MAX=10`, `CARPETA_NOMBRE_MAX=24`, `CARPETA_ICONO_MAX=8`, `CARPETA_CHATS_MAX=100`, `CHATS_FIJADOS_MAX=5`, `MENSAJES_FIJADOS_MAX=3`, `NOTAS_MAX=1000`, `SIN_SESION`.
- `COLORES_ETIQUETA: readonly { color: ColorEtiqueta; nombre: string }[]` (10, Spanish names: Azul, Naranja, Esmeralda, Ámbar, Rosa, Verde, Lavanda, Rojo, Celeste, Morado). `REACCIONES = ["👍","❤️","😂","😮","😢","🙏"] as const`, `type Reaccion`.
- Normalizers: `normalizarNombre(s)`, `normalizarIcono(s) → string|null`, `normalizarNotas(s) → string|null`, `normalizarReaccion(s) → string|null`, `largo(s)` (code points, = char_length), `recortar(s, max)` (adds "…").
- Schemas: `etiquetaSchema {id?: number|null, nombre, color}` (type `EtiquetaInput`), `carpetaSchema {id?: number|null, nombre, icono?: string|null}` (type `CarpetaInput`), `clienteIdSchema`, `etiquetaIdSchema`, `carpetaIdSchema`, `mensajeIdSchema`, `respondeASchema` (nullable), `etiquetasIdsSchema` (≤20, unique), `carpetasIdsSchema` (≤10, unique), `ordenCarpetasSchema`, `clientesIdsSchema` (≤100, unique), `reaccionSchema` (nullable), `notasSchema` (nullable), `booleanoSchema`; `firstError(zodError, fallback?) → string`. UI forms can `safeParse` with them for instant errors.
- Message types: `AutorChat = "cliente"|"asesor"`; `CitaMensaje {id, autor, texto /* summary ≤120, with 📷/🎤 */, adjunto_tipo}`; `MensajeFijado extends CitaMensaje {fijado_en: string}`; `ReaccionMensaje {emoji: Reaccion, autor: AutorChat, propia: boolean /* the viewer's own */}`; `InteraccionesMensaje {responde_a: number|null, cita: CitaMensaje|null /* null if not a reply OR not visible (show "Mensaje eliminado" when responde_a && !cita) */, fijado_en: string|null, reacciones: ReaccionMensaje[] /* one per person, oldest first; group by emoji in the UI */}`.
- `cargarInteracciones(supabase, clienteId, mensajes, {userId, visibleDesde?})` — server-only helper used by the read actions.

### `@action/manager-and-admin/mensajes/mensajes-action` (staff)
- Types: `ClienteChat {username, email, phone}` (all `string|null`); `Conversacion {cliente_id, cliente: ClienteChat|null, ultimo: {id, texto /* summary */, autor: AutorChat, created_at}, sinLeer: number, fijadoEn: string|null, archivadoEn: string|null, noLeidoManual: boolean, etiquetas: number[], carpetas: number[]}`; `Etiqueta {id, nombre, color: ColorEtiqueta}`; `Carpeta {id, nombre, icono: string|null, orden, chats: number}`; `Bandeja {conversaciones /* newest first, archived included; UI sorts pinned first and filters archivadoEn */, etiquetas /* by nombre */, carpetas /* by orden */}`; `MensajeStaff extends InteraccionesMensaje {id, autor, texto, pedido_id, autor_via, created_at, adjunto_tipo, adjunto_url}`; `PedidoResumen` (unchanged); `EstadoChat {fijadoEn, archivadoEn, noLeidoManual, notas: string|null, etiquetas: number[], carpetas: number[]}`.
- `getConversacionesAction(): Promise<Bandeja | null>` (null = error/no permission).
- `getConversacionAction(clienteId: string): Promise<DetalleConversacion>` = `{ok: true, cliente: ClienteChat|null, clienteDesde: string|null, estado: EstadoChat, mensajes: MensajeStaff[] /* oldest first, last 300 visible (id > eliminado_hasta) */, fijados: MensajeFijado[] /* ≤3, newest pin first, may be outside the window */, pedidos: PedidoResumen[]} | {ok: false, error}`. Marks the chat read (also clears `noLeidoManual`, returned as false).
- `enviarMensajeStaffAction(clienteId: string, texto: string, adjunto: AdjuntoSubido|null = null, respondeA: number|null = null): Promise<{ok: true}|{ok: false, error}>`.

### `@action/manager-and-admin/mensajes/etiquetas-action` (staff)
- `guardarEtiquetaAction(input: EtiquetaInput): Promise<Resultado<{id: number}>>` (no id = create).
- `eliminarEtiquetaAction(id: number): Promise<Resultado>`.
- `asignarEtiquetasAction(clienteId: string, ids: number[]): Promise<Resultado>` (exact set; `[]` = none).

### `@action/manager-and-admin/mensajes/carpetas-action` (staff)
- `guardarCarpetaAction(input: CarpetaInput): Promise<Resultado<{id: number}>>` (no id = create at the end).
- `eliminarCarpetaAction(id: number): Promise<Resultado>`.
- `ordenarCarpetasAction(ids: number[]): Promise<Resultado>` (all folder ids, new order).
- `carpetaChatsAction(carpetaId: number, clienteIds: string[]): Promise<Resultado>` (exact members, ≤100).
- `carpetasDeClienteAction(clienteId: string, ids: number[]): Promise<Resultado>` (exact folders of one chat).

### `@action/manager-and-admin/mensajes/estado-action` (staff)
- `fijarChatAction(clienteId, fijar: boolean)`, `archivarChatAction(clienteId, archivar: boolean)`, `eliminarChatAction(clienteId)`, `marcarNoLeidoAction(clienteId, noLeido: boolean)`: all `Promise<Resultado>`.
- `guardarNotasAction(clienteId: string, notas: string|null): Promise<Resultado<{notas: string|null}>>` (returns the normalized notes).
- `getSinLeerStaffAction(): Promise<number>` — never throws; 0 on error or non-staff (sidebar badge, T5).

### `@action/chat-mensaje-action` (staff or the chat's own client; the RPC authorizes)
- `reaccionarMensajeAction(mensajeId: number, emoji: string|null): Promise<Resultado<{emoji: Reaccion|null}>>` — same emoji again or null removes; returns what remains.
- `fijarMensajeAction(mensajeId: number, fijar: boolean): Promise<Resultado>` — 4th pin unpins the oldest.
- Errors: `SIN_SESION` (no session), `SIN_PERMISO` (other chat), `Mensaje no encontrado.`, `Reacción no válida.`. Neither revalidates: the caller refetches its thread (`getConversacionAction` / `getMensajesAction`).

### `@action/tienda/chat-asesor-action` (client)
- `MensajeChat extends InteraccionesMensaje {id, autor, texto, pedido_id, leido, created_at, adjunto_tipo, adjunto_url}`.
- `getMensajesAction(): Promise<ChatResult>` = `{ok: true, mensajes: MensajeChat[], fijados: MensajeFijado[]} | {ok: false, error}`.
- `enviarMensajeAction(texto, pedidoId: number|null, adjunto: AdjuntoSubido|null = null, respondeA: number|null = null)`.

### Telegram
- Every Telegram copy of a Playr message is recorded in `telegram_hilo.mensaje_id` (client message → `reenviarMensajeAsesor`; panel reply → `copiarMensajePanelTelegram`, `pedido_id` null; advisor's Telegram message → webhook).
- Outgoing reply: replies to the latest Telegram copy of `responde_a` (`reply_parameters`, `allow_sending_without_reply`); no copy → quoted line `↩️ <i>«first 80 chars»</i>`.
- Incoming: an advisor's Telegram reply to a mirrored message is saved with `responde_a` (only if that message is in the same client's chat). The webhook revalidates `/administrar/mensajes` and `/administrar/compras`.
