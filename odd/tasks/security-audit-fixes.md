# Security audit fixes

Locator: `odd/tasks/security-audit-fixes.md` · Engram mirror: `odd/security-audit-fixes/tasks` (PENDING: engram MCP down this session)
Branch: `fix/auditoria-seguridad-2` (from `develop`, worktree `.claude/worktrees/seguridad`)

## Objective
Fix every finding of the 2026-10-04 security audit, most critical first, asking the user each product decision.

## Problem
Audit findings (read-only pass, 2026-10-04): Next.js RCE advisories; deleted customers keep access; past buyers keep reading resold credentials; stock lock via junk receipts + raceable pending limit; weak auth hardening for staff; 4 live migrations not in git; alert-bell spam; CSP unsafe-inline; plus lows (uploads quota, view write grants, reservado trigger, Telegram chat id, raw auth errors, enc key as RPC arg).

## Why
User request 2026-10-04: "procede con los más críticos a los más leves, todo debe quedar arreglado; pregúntame las decisiones".

## Scope (authorized)
- All audit findings.
- Out: the chat-asesor feature itself (another session is actively editing `.claude/worktrees/chat-asesor`, incl. `crear_pedido`, `crear-pedido-action.ts`, `pedido.ts`, telegram route). Items touching those files wait until that session finishes, then rebase on its definitions.
- Out (user decision): committing the 4 chat migrations — the other session does it (F1).

## Decisions (user, 2026-10-04)
- #3: column `profile.vendido_pedido_id`; only that order sees credentials, profile must be vendido + exist + not expired.
- #4: 1 pending order per customer, max 5 profiles; pending orders do NOT expire.
- #6: other session commits its migrations.
- #5: own rate limit (no MFA, no captcha) + Auth password policy (min 10, lower/upper/digit/symbol, reauth on change).
- #8: nonce CSP + img-src closed.
- Enc key: move ACCOUNT_ENC_KEY into Supabase Vault (WAITS other session: claves.ts, licencias_cache).

## Constraints
- Migrations cannot be `db push`ed until the chat migrations are in git (remote has versions missing locally). Apply step pending.
- Never `git add -A`; explicit paths.

## Tasks
- [x] T1 — Upgrade next to >=16.3.6 (+ sharp/postcss transitive). Route: inline. Risk: medium.
- [x] T2 — Deleted customer: ban + signOut in Auth on delete; check `client.exist` in getRoleUser. Route: inline. Risk: high.
- [x] T3 — `vendido_pedido_id` column + accesos filter. Route: inline. Risk: high.
- [x] T4 — crear_pedido: per-customer advisory lock, 1 pending, 5 profiles, `client.exist` check. WAITS other session. Risk: high.
- [x] T5 — Auth hardening: own rate limit + app password policy DONE (code + migration 230002); Auth config PATCH pending (prod apply step). Risk: high.
- [x] T6 — Alert spam: validate receipt path server-side, notify only if object exists; catalog action early return without session. Partly WAITS other session. Risk: medium.
- [x] T7 — CSP per user decision. Risk: medium.
- [x] T8 — Lows: revoke view write grants + default privileges; reservado trigger on exist/account_id; Telegram chat id check; generic auth errors; upload quota/cleanup; enc key. Risk: medium.

## Acceptance criteria
1. `pnpm audit --prod` shows no critical/high in next.
2. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` pass.
3. SQL checks (`supabase/checks/*.sql`, ROLLBACK) pass against the migration.

## Checks
- TDD: off — source: project has no test suite — runner: n/a
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`

## Progress / Evidence
- T1: next 16.3.8, eslint-config-next 16.3.6, nanoid override; `pnpm audit --prod`: No known vulnerabilities; lint/tsc/build pass.
- T2: puedeGestionarUsuario (manager cannot touch staff, no self-delete), ban 876000h on delete, getRoleUser returns error when client.exist=false; tsc/lint pass.
- T3: migration 20261005100001 + supabase/checks/perfil_vendido_check.sql → OK against linked DB (rollback). Accesos filtered by vendido_pedido_id, exist, estado, vencimiento.
- T5 (partial): migration 20261005100002 rate limit tested in rollback (4 fails false, 5 true, clear false; authenticated denied).
- T7: CSP moved to proxy.ts with per-request nonce (app/lib/csp.ts), root layout awaits connection(); next start: 16/16 scripts carry nonce, page hydrates, no console errors.
- T8 (partial): migration 20261005100003 (view grants, reservado guard on exist/account_id, comprobantes orphan cap 5/day) + checks/endurecer_permisos_check.sql OK; generic auth errors; catalog action returns early without session.
- RDD (candidate b7657e9, high, 3 lenses): approved, 0 blockers. Warnings fixed after ack: en_soporte backfill; atomic attempt reservation (auth_intentar with per-email advisory lock); no lockout by email alone (5 per email+IP, 30 per IP, 50 per email global + staff alert); checks/auth_intento_check.sql + account_id case. All 3 SQL checks OK. Pending: receipt-cap message in pago-breb-modal (file owned by chat session) → wait phase.
- Migrations renamed 20261004230001-3 → 20261005100001-3 (chat session created its own 20261004230001).
- Commit 0233a9b (first batch). Merged develop (chat-asesor) in acf7294: CSP conflict resolved keeping media-src/connect-src blob: rules in app/lib/csp.ts.
- T4: migration 20261005100004 (client exist check, per-customer advisory lock, 1 pending, max 5 profiles; MAX_PERFILES_PEDIDO=5) + checks/crear_pedido_limites_check.sql OK. Existing pedido_check stays compatible (second order only after the first is rejected).
- T6: crear-pedido-action validates receipt path shape/owner (esRutaComprobante), total bounds, and notifies only if the object exists.
- T8: Telegram callbacks only from cfg.chatId; chat bucket quota migration 20261005100005 + checks/chat_cuota_check.sql OK; RLS-cap messages in pago-breb-modal and chat-compositor; enc key → Vault (migration 20261005100006, business.enc_key(), 6 functions without key param, TS callers no longer send it) + checks/enc_key_vault_check.sql OK (delegated writer; parent re-ran all 6 checks OK, tsc/lint OK).
- Pending prod apply (in order): create Vault secret account_enc_key with the current ACCOUNT_ENC_KEY value; db push of 20261005100001-6; Auth config PATCH (min 10, lower_upper_letters_digits_symbols, secure password change); deploy code (merge to master). Then optionally remove ACCOUNT_ENC_KEY from Vercel/.env.

## Delivery
Forecast: ~400-600 authored lines. Strategy: ask-on-risk.

## Next step
RDD on the second batch; user approval to commit; then production apply in the order above (each step needs explicit confirmation).
