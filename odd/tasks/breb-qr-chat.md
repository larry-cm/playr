# Bre-B QR payment through the advisor chat

Locator: `odd/tasks/breb-qr-chat.md` · Engram mirror: `odd/breb-qr-chat/tasks`
Branch: `feature/breb-qr-chat` (from `develop`, worktree `.claude/worktrees/breb-qr-chat`)

## Objective
A customer who picks "Pagar por QR" gets an order waiting for its receipt, the advisor chat opens with an automatic advisor message carrying the Bre-B QR and the amount, and the customer delivers the receipt in the chat (image or PDF, or shared from the bank app into the installed Playr PWA). The first receipt moves the order to `pendiente`.

## Problem
- `business.crear_pedido` requires the receipt upfront (`comprobante_path not null`, migration 20261005100004); the QR lives only in the payment modal (`app/administrar/tienda/pago-breb-modal.tsx`).
- The chat only accepts images and voice notes (`app/lib/chat-adjunto.ts`), no PDF.
- No PWA manifest: Playr never shows up in the Android share sheet of Nequi or the bank.

## Why
User request 2026-10-04. Decisions (verbatim from the user):
1. "Al elegir 'Pagar por QR' se crea el pedido, se abre el chat y aparece al instante un mensaje del asesor con el QR de la llave y el monto. El asesor no tiene que hacer nada." (personal Nequi QR is fine)
2. "Compartir + adjuntar": PWA share target (Android) + attach image/PDF in the chat.
3. "El pedido queda 'esperando comprobante' con los perfiles apartados; el primer comprobante que llega por el chat se le asocia y pasa a 'por verificar' hasta que se verifique el comprobante por el asesor no se libera."

## Scope (authorized)
- New order state `esperando_comprobante`, QR order RPC, attach-receipt RPC, PDF in chat, automatic advisor QR message, staff views, PWA share target, docs.
- Defaults (orchestrator, not objected): share target Android only; staff can reject an `esperando_comprobante` order (only way to free its profiles); the legacy "upload receipt upfront" path stays as secondary option.
- Out: auto-expiry of waiting orders; `supabase db push` without explicit user "yes".

## Constraints
- Shared remote DB with prod and other sessions: migrations validated in sandbox, never pushed without confirmation.
- `alter type ... add value` cannot be used in the same transaction: enum value in its own migration.
- Per-tab sessionStorage session; server is anonymous without `x-playr-token` → share target stores the file client-side (SW + IndexedDB).
- ~400 authored lines per task is advisory only.

## Tasks
- [x] T1 — DB: migrations (enum value; nullable receipt + CHECK; `crear_pedido_qr`; `adjuntar_comprobante`; reject from waiting; pending limit counts both states; chat `documento` PDF + bucket mime) + `supabase/checks/pedido_qr_check.sql`. Route: delegated (writer, 2+ files + preparation). Risk: high.
- [x] T2 — Server actions + libs (create QR order, attach receipt, chat PDF rules, Telegram notices). Route: delegated (writer). Risk: high.
- [x] T3 — Tienda modal + customer chat UI (Pagar por QR → chat with QR, composer image/PDF, badge in Mis compras). Route: delegated (writer). Risk: medium.
- [x] T4 — Staff views (Pedidos with waiting state, reject only; Mensajes renders QR/PDF). Route: delegated (writer). Risk: medium.
- [x] T5 — PWA manifest + service worker share target → IndexedDB → attach in Mis compras; CSP. Route: delegated (writer). Risk: high.
- [x] T6 — CLAUDE.md sections 6/18/21. Route: inline. Risk: passive.
- [x] T7 — Full verification (lint, tsc, build, SQL check, local e2e with user-approved test data) + RDD. Route: inline. Risk: high.

## Acceptance criteria
1. `pedido_qr_check.sql` passes with ROLLBACK and leaves no rows.
2. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` pass.
3. "Pagar por QR" creates an `esperando_comprobante` order with reserved profiles and the chat shows the advisor QR message with the amount.
4. First image/PDF receipt in chat → order `pendiente` with `comprobante_path`, Telegram notice with Aprobar/Rechazar.
5. Manifest valid with `share_target`; shared file lands in Mis compras and attaches to the waiting order.

## Checks
- TDD: off — source: project (no test suite) — runner: n/a
- `pnpm lint` · `pnpm exec tsc --noEmit` · `pnpm build` · SQL check in PGlite sandbox / `supabase db query --linked -f supabase/checks/pedido_qr_check.sql` (after push only)

## Progress / Evidence
- T1 written (not pushed, not committed): `supabase/migrations/20261006100001_pedido_esperando_comprobante_enum.sql` (enum value alone), `supabase/migrations/20261006100002_pedido_qr_chat.sql`, `supabase/checks/pedido_qr_check.sql`. Versions checked against `supabase migration list --linked` (remote max 20261005100006) and the other worktrees.
  - Design: receipts stay in bucket `comprobantes` (same upload, staff signing, Telegram download); `mensaje_asesor.adjunto_bucket` ('chat' default | 'llaves-qr' | 'comprobantes'); `adjunto_tipo` adds 'documento'; bucket `chat` accepts `application/pdf`. Shared internal `business.pedido_reservar` (no EXECUTE for clients) used by `crear_pedido` (same signature) and new `crear_pedido_qr(bigint[], numeric, bigint default null)`; new `adjuntar_comprobante(bigint, text)` returns the chat message id; `rechazar_pedido` accepts 'esperando_comprobante'; `aprobar_pedido` refuses it with its own message.
  - PGlite sandbox (all 38 real migrations + stubs of auth/storage/vault): `node run.mjs pedido_qr_check.sql pedido_check.sql crear_pedido_limites_check.sql chat_cuota_check.sql endurecer_permisos_check.sql perfil_vendido_check.sql` → all `OK`, 0 residual rows. 9/9 mutations of migration B make `pedido_qr_check` fail.
  - Not proven in sandbox: real Storage API (mime/size enforcement, signed URLs), real Supabase auth/PostgREST; prod run of the check needs `db push` first.
- T2–T4 written (not committed; coded against the unpushed T1 contract, no runtime e2e yet):
  - T2: `app/action/tienda/crear-pedido-qr-action.ts` (crear_pedido_qr + campana + `avisarPedidoEsperandoTelegram`: plain notice, no buttons, no QR copy), `app/action/tienda/adjuntar-comprobante-action.ts` (adjuntar_comprobante + same `avisarPedidoTelegram` as a new order). `chat-adjunto.ts` adds `documento`/`BucketAdjunto`/`tipoAdjunto`/`ARCHIVO_ACCEPT`; `chat-firmar.ts` signs per bucket (`chat`/`comprobantes` signed 1 h with the caller's session, `llaves-qr` public URL); chat actions select `adjunto_bucket` and accept `documento`; Telegram sends `documento` as sendDocument from the message's bucket; webhook stores advisor PDFs as `documento`; `pedido.ts` state `esperando_comprobante` ("Esperando comprobante").
  - T3: modal "Pagar por QR" (only when the chosen key has QR; in-modal QR image removed, it now arrives in the chat) → `/administrar/compras?chat=<id>` opens the chat on that order; legacy upload stays as secondary submit. Chat: QR image with "Guardar QR", PDF file card with "Abrir", broken/HEIC image falls back to "Abrir"; composer picks images or PDF. Amber banner "Enviar comprobante" in the chat when an order waits (uploads to `comprobantes` + attach action; normal attachments still go to `chat`). Mis compras: badge + "Enviar comprobante" button opens the chat. Reusable `app/administrar/compras/enviar-comprobante.ts` → `enviarComprobante(pedidoId, file)` for T5.
  - T4: Pedidos tab "Esperando comprobante", Rechazar only + note, "Ver comprobante" hidden without receipt, `getComprobanteUrlAction` refuses null path; Mensajes renders QR/PDF/receipts, automatic message signed "Mensaje automático".
  - `pnpm exec tsc --noEmit`: exit 0 (after `pnpm build` generated `next-env.d.ts`). `pnpm lint`: clean. `pnpm build`: compiled, 19/19 pages.
- T5 written (not committed): `app/manifest.ts` (standalone, start `/administrar`, icons any+maskable 192/512 in `public/icons/` generated from `favicon.svg` with the `sharp` already in node_modules, `share_target` POST multipart → `/compartir` field `archivo`, `launch_handler` navigate-existing so a share reuses the open window/session), `public/sw.js` (only intercepts POST /compartir: first file → IndexedDB `playr-compartir/archivos/ultimo` {archivo,nombre,tipo,fecha}, 303 → `/administrar/compras?compartido=1`; no caching), `app/sw-register.tsx` in the root layout, `app/compartir/route.ts` (fallback 303 when the SW is not active; file lost), CSP `worker-src 'self'; manifest-src 'self'`, proxy matcher skips `sw.js`/`manifest.webmanifest`, `next.config.ts` no-store + JS content-type for `/sw.js`. Mis compras: `compartido.tsx` reads+deletes the file once (≤30 min old, type from extension if empty) → exactly one waiting order: `enviarComprobante` + success notice + chat on that order; none: send to advisor as a normal chat attachment or discard; missing: attach from chat. T5b: while an order waits, the composer's paperclip/paste/drag file goes to `enviarComprobante` (`desviarArchivo` prop of `chat-compositor.tsx`, accept = `COMPROBANTE_ACCEPT`) with a hint "La imagen o PDF que envíes será el comprobante del pedido #N"; `subirAdjunto` exported from the compositor for reuse.
  - `pnpm exec tsc --noEmit`: exit 0. `pnpm lint`: exit 0. `pnpm build`: compiled, 21/21 pages (`/compartir` ƒ, `/manifest.webmanifest` ○).
  - `next start -p 3917`, no login: manifest 200 `application/manifest+json` with `share_target`; `/sw.js` 200 `application/javascript; charset=utf-8`, `Cache-Control: no-cache, no-store, must-revalidate`; 4 icons 200 `image/png`; home CSP includes `worker-src 'self'; manifest-src 'self'` and `<link rel="manifest">`; `POST /compartir` (multipart, no SW) → 303 `Location: /administrar/compras?compartido=1`; that URL without session → 307 `/` + `playr-volver=/administrar/compras?compartido=1`.
  - Not proven: SW registration in a browser (agent-browser MCP hung; CLI eval blocked by the worktree guard), real Android share sheet, IndexedDB hand-off, logged-in flows (shared prod DB).

- T6: CLAUDE.md section 21 (Pagar por QR, PWA share, PDF in chat).
- T7: pnpm exec tsc --noEmit: exit 0 · pnpm lint: clean · pnpm build: OK (21 pages) · sandbox pedido_qr_check + pedido_check: OK (parent spot check). Pending: db push (user confirmation) and logged-in e2e (needs push; shares prod DB).

## Review ledger
- Candidate b2c53073 (base 58b68efa): risk medium (executable_change), 38 paths / 1782 lines, slice_budget_reached. Consent: granted, lens risk.
  - RISK-001 (risk, public/sw.js:42, WARNING, candidate, info): cross-site form POST to /compartir could plant a receipt on the victim's waiting order. Follow-up fixed: SW ignores Sec-Fetch-Site cross-site (candidate b8b77f64, under_budget, 7 lines).
  - No BLOCKER/CRITICAL → no refuter/correction. Ack: b2c53073 approved.

## Delivery
Actual: ~1790 changed lines (incl. ~640 SQL). Strategy: ask-on-risk. Proposed slices: commit 1 = T1 (migrations + check); commit 2 = T2–T6 (app, PWA, docs, feature doc) — T3 and T5 share chat files, no cohesive finer split. Local merge to develop (no PR flow in this repo).

## Next step
User: approve commits; confirm `supabase db push` of 20261006100001/2 (irreversible enum value); then logged-in e2e with a test customer.
