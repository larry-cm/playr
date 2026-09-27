# Audit follow-ups: Bodega live data, stale check, logged-in E2E

Locator: `odd/tasks/audit-followups-bodega-live-and-e2e.md` · Engram mirror: `odd/audit-followups-bodega-live-and-e2e/tasks`
Branch: `fix/auditoria-seguridad-ux` (from `develop`, worktree `../playr-auditoria`)

## Objective
Close the three items left open after the security/UX audit fixes: Bodega shows scan time and live price/stock/saldo before buying; `bodega_check.sql` passes; logged-in flows verified with temporary users.

## Problem
- `business.extraction_run` stores only `fecha_extraccion` (date), so Bodega can't show the scan time.
- Stock is never stored (the provider's /tienda listing has no quantities); quantity is capped only by `MAX_CANTIDAD`.
- `supabase/checks/bodega_check.sql` asserts one account per profile in `registrar_licencias`; since `20260922025911_registrar_licencias_agrupa_cuenta` profiles are grouped.
- No logged-in test was run after the audit fixes (no test account; public sign-up is now closed).

## Why
User request 2026-09-27: "Arranca con los 3 con agentes paralelos".

## Scope (authorized)
- Additive migration `extraction_run.created_at timestamptz default now()`; Bodega reads it.
- New staff-only server action reading live price/stock/saldo from the provider when the purchase modal opens (no cart changes, no payment).
- Update `bodega_check.sql` to the current `registrar_licencias` behaviour.
- Temporary test users (manager + user, `@example.com`), local run with `BODEGA_SIMULAR=1`, deleted afterwards.
- Out: storing stock in the cron; any real purchase.

## Constraints
- Never pay: `BODEGA_SIMULAR=1` for any local run; the live-read action never touches the cart.
- Parallel writers approved by the user with disjoint edit surfaces.
- ~400 authored lines per task is advisory only.

## Tasks
- [x] T1 — Scan time + live price/stock/saldo in the Bodega purchase modal. Route: delegated (writer, 2+ non-trivial files). Risk: high (touches real-money flow UI; read-only on provider).
- [x] T2 — Update `bodega_check.sql` to grouped accounts and make it pass (ROLLBACK). Route: delegated (preparation read of migration). Risk: medium.
- [ ] T3 — Logged-in E2E with temporary manager/user, then cleanup. Route: delegated (web-auditor). Risk: high (creates/deletes auth users). Blocked: needs `SUPABASE_SECRET_KEY` in `.env`.

## Acceptance criteria
1. Bodega modal shows "Escaneo: dd/mm/aaaa hh:mm" for new runs and "verificado ahora" price/stock/saldo; quantity capped at live stock; price change warned before confirming.
2. `supabase db query --linked -f supabase/checks/bodega_check.sql` returns `bodega_check: OK`.
3. E2E report: manager CRUD on clientes, Bodega up to pre-payment, notifications; user blocked from staff pages/actions/PostgREST tables; Tienda + Soporte work; test users deleted.
4. `pnpm lint`, `pnpm exec tsc --noEmit -p .`, `pnpm build` clean.

## Checks
- TDD: off — source: project has no test runner (only `node supabase/functions/stock-price-watch/lib_test.ts`).
- `pnpm lint`; `pnpm exec tsc --noEmit -p .`; `pnpm build`; the two `supabase/checks/*.sql`.

## Progress / Evidence
- T1 (2026-09-27): migration `20260927210001_extraction_run_hora.sql` written, NOT applied (nullable `created_at`, default `now()` set after adding: old runs stay NULL). `leerCatalogoBodega` returns `escaneoEn`; heading/modal show "Escaneo del dd/mm/aaaa, hh:mm" (America/Bogota) or just the date. `consultarEnVivo` (compra.ts, read-only) + `consultarProductoBodegaAction` (esStaff); the modal verifies on open, caps qty at live stock, warns on price change and sends the shown price, disables Comprar at stock 0. `pnpm lint`, `tsc --noEmit`, `pnpm build`: exit 0. One read-only live run of `consultarEnVivo` (node script, no cart/checkout): ok, price/stock/saldo in ~2.6 s. Apply the migration BEFORE deploying this code (the `created_at` select fails without it).
- T2 (2026-09-27): `bodega_check.sql` steps 8-10 and 12 rewritten for grouped accounts (1 account per platform+email, perfil_max = greatest(perfil_max, live profiles), all-or-nothing also for profiles, other email = own account). `bodega_check: OK` and `notificacion_check: OK` against the linked DB (run with psql over the pooler: `db query --linked` returned 401). Reported, not fixed: renewal (same email+perfil, other vence) is grouped into the existing account without its vence/password, so retrying it duplicates the profile (not idempotent); a `completa` licence with the same email joins the `pantalla` account.

- T3 (2026-09-27): stopped by the user mid-run (after login step). Leftover temp users (manager, cliente, UI-created client) deleted via admin API (0 e2e-* users remain); dev server on :3100 stopped. No results recorded. Pending: re-run or skip, per user.

- T1 migration 20260927210001 applied to prod by the user (db push OK).

## Delivery
Forecast: ~300 authored lines. Strategy: ask-on-risk. Slices: goes into the audit branch with the rest of the fixes.

## Next step
T1 and T2 running in parallel; T3 waits for `SUPABASE_SECRET_KEY`.
