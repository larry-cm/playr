# Bodega order history cached in DB

Locator: `odd/tasks/bodega-order-history-cache.md` · Engram mirror: `odd/bodega-order-history-cache/tasks` (PENDING: engram MCP unavailable this session)
Branch: `feature/historial-proveedor-cache` (from `develop`, worktree `.claude/worktrees/historial-proveedor`)

## Objective
The Bodega "Registro de compras" loads instantly from a DB cache instead of scraping the provider site on every visit; purchases made in the platform are appended immediately and a daily sync merges orders made directly on the provider site, sorted by date.

## Problem
- `getPedidosProveedorAction` (app/action/manager-and-admin/bodega/compras-action.ts) logs in cold and paginates `/mi-cuenta/orders/` (up to 20 pages, sequential) + `/mi-cuenta/view-license-keys/` on every page load.
- Server actions from one client run serially in Next.js, so the history waits for the saldo action too (bodega-client.tsx:91-100 comment claims parallel; it is not).

## Why
User request 2026-10-03: Bodega module too slow; cache history in DB keyed by provider account identity, keep working with platform-made purchases, sync with the provider once a day, merge unprocessed provider orders by date.

## Scope (authorized)
- New table + security-definer merge RPC; account identity = sha256(host + lowercased email) so a provider account change gets its own cache.
- Cached read on page load (server-side, first render), lazy daily sync (first visit after 24 h, in background) + manual "Sincronizar" button, append after a paid purchase, forced sync after an `incierta` purchase.
- Mark each cached order with `origen`: `plataforma` (matches `compra_proveedor.pedido_proveedor`) or `proveedor` (made on the site directly).
- Out: saldo stays live (never stored); no Edge Function cron port of the scraper; no inventory registration.

## Constraints
- Postgres TOAST compresses the jsonb array automatically (lz4/pglz); stored compact and already formatted (`PedidoProveedor[]` + `origen`).
- Merge happens in SQL under a row lock (append vs sync race safe); provider data wins on conflict; union by order id keeps old orders beyond the 20-page scrape cap.
- RLS: staff only (`business.es_staff()`); no direct INSERT/UPDATE grants.
- ~400 authored lines per task is advisory only.

## Tasks
- [x] T1 — Migration `business.historial_proveedor` + `historial_fusionar()` RPC + check SQL. Route: delegated (writer, 2+ files). Risk: high (migration).
- [x] T2 — Server: account id, cached read, sync and append actions; comprar-action appends on `pagada`. Route: delegated (same writer). Risk: medium.
- [x] T3 — UI: page passes cached history; client syncs lazily, "Sincronizar" button, last-sync label, origen badge; docs (app/lib/bodega/CLAUDE.md). Route: delegated (same writer). Risk: medium.

## Acceptance criteria
1. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` pass.
2. Bodega first render shows the cached history with no provider request when cache is < 24 h old.
3. Check SQL (ROLLBACK) proves: staff-only, merge by id, provider wins, order by fecha desc, origen computed.
4. Migration not pushed without user confirmation.

## Checks
- TDD: off — source: project has no test suite (CLAUDE.md §13) — runner: n/a; SQL check file + lint/tsc/build.

## Progress / Evidence
- 2026-10-03 T1: `node run-check.mjs` (PGlite 17, minimal Supabase skeleton + real `20260920190001_bodega.sql` up to actualizar_compra + new migration + check) => `historial_proveedor_check: OK`, 0 residual rows. Mutation testing, 7/7 killed: sin_staff ("cliente no debe poder fusionar el historial"), gana_viejo ("el pedido que llega debe ganar"), orden_asc ("orden esperado ..."), sello_siempre ("fusionar sin sincronizar no debe sellar"), sin_union ("los pedidos que no vienen se conservan"), origen_fijo ("debe ser origen plataforma"), grant_update ("staff no debe poder actualizar directo"). Linked-DB check PENDING: migration not pushed (needs user approval), so `historial_fusionar` does not exist remotely yet.
- 2026-10-03 T2/T3: `pnpm lint` => exit 0, no findings. `pnpm exec tsc --noEmit` => exit 0 (after build generated next-env types; before build only pre-existing `@/public/favicon.svg` TS2307). `pnpm build` => exit 0 with placeholder NEXT_PUBLIC_SUPABASE_URL/KEY (worktree has no .env; without them `/reestablecer` prerender fails, unrelated); `/administrar/bodega` built as dynamic.
- 2026-10-03: `supabase db push` (user approved) applied only 20261003120001_historial_proveedor.sql; `supabase db query --linked -f supabase/checks/historial_proveedor_check.sql` => `historial_proveedor_check: OK`.
- Not verified: live UI with a staff session (dev server for the worktree on :3001, user smoke test pending).

## Review ledger
- T1–T3 (single work unit): base ad1e7f3 / candidate 3ca280b, risk medium (executable_change), 13 paths / 606 lines, slice_budget_reached, consent granted, lens reliability.
- RELIABILITY-001 WARNING info: TS side of criteria 2 and "append failure never changes purchase" has no executable test (no suite); covered by manual smoke test.
- No blockers; acknowledged `approved`.

## Delivery
Forecast: ~450 authored lines. Strategy: ask-on-risk. Slices: single feature branch.

## Next step
User approves `supabase db push` (migration 20261003120001), then run `supabase db query --linked -f supabase/checks/historial_proveedor_check.sql` and smoke-test /administrar/bodega.
