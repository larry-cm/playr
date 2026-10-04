# Per-tab sessions + one active session per account

Locator: `odd/tasks/auth-sesion-por-pestana.md` · Engram mirror: `odd/auth-sesion-por-pestana/tasks` (pending: engram MCP unavailable this session)
Branch: `feature/auth-sesion-por-pestana` (from `develop`, worktree `../playr-auth-sesiones`)

## Objective
Each browser tab holds its own independent session (different accounts per tab are possible), a new tab never inherits another tab's login, and an account can only be signed in in one place at a time (new login closes the others).

## Problem
- Supabase SSR stores the session in cookies with `path=/` (`app/lib/supabase/{server,middleware,client}.ts`), shared by every tab of the browser.
- Login (`app/action/login/login-action.ts`) never revokes other sessions of the account.

## Why
User request 2026-10-03; user chose "different accounts per tab" over "last login wins".

## Scope (authorized)
- Tab-scoped URLs `/s/<sid>/administrar/...`: `proxy.ts` rewrites to `/administrar/...` and passes `x-playr-sid`; session cookies are named `sb-<sid>` with `Path=/s/<sid>`, so the browser isolates them per tab.
- Login generates the sid on the client (sessionStorage), signs in, revokes the account's other sessions (`signOut({ scope: "others" })`).
- Client guard: a tab whose sessionStorage sid differs from the URL (link opened in a new tab, duplicated tab) goes back to login.
- All internal links / redirects to `/administrar` get the tab prefix.
- Out: realtime kick of a revoked session (it is detected on the next request).

## Constraints
- `revalidatePath("/administrar/...")` keeps the internal (rewritten) path.
- ~400 authored lines per task is advisory only.

## Tasks
- [x] T1 — Core: sid helpers, proxy rewrite, tab-scoped server/browser clients, login with sid + revoke others, tab guard, logout, reset-password cleanup. Route: inline (design held in parent context). Risk: high (auth).
- [x] T2 — Prefix every internal `/administrar` link/redirect. Route: delegated (writer, 20+ mechanical files). Risk: medium.
- [x] T3 — Verify in a real browser: two tabs with two accounts, new tab asks for login, second browser login kicks the first. Route: inline.

## Acceptance criteria
1. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` pass.
2. Tab A logged in as X, tab B (new) shows login; logging in B as Y leaves A on X.
3. Ctrl+click on an internal link opens login in the new tab.
4. Logging in X in another browser context makes the first context land on login at its next request.

## Checks
- TDD: off — source: project has no test suite — runner: n/a
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`, agent-browser manual run.

## Progress / Evidence
- T1+T2: `pnpm exec tsc --noEmit` OK, `pnpm lint` OK, `pnpm build` OK. T2 delegated writer (21 files under app/administrar). supabase-js reports a revoked session as AuthSessionMissingError (no session_not_found code): proxy flags `?sesion=cerrada` when the tab sent its cookie.
- T3 (next start :3107, agent-browser, 2 temp users created and deleted): tab A=user A and tab B=user B coexist after reloads; new tab on "/" shows login; A's URL opened in a new tab → "/"; aside client nav keeps prefix and active item; 2nd browser login kicks the 1st on reload and on client nav with the notice; the other account stays; logout clears the tab cookie and the old URL → "/". Not verified: duplicated-tab BroadcastChannel path (no way to duplicate a tab from agent-browser).

## Delivery
Forecast: ~350 authored lines. Strategy: ask-on-risk. Slices: single PR.

## Next step
RDD review, then user approval of the commit.

## Review ledger
- Work unit T1-T3. base 84e81a8e, candidate 47fe3f05, corrected 14a8639b. Risk high (hot_path:auth), 3 lenses, consent granted.
- RELIABILITY-001 / RESILIENCE-001 CRITICAL deterministic (server.ts): sid-less server client dropped the PKCE code-verifier cookie → password recovery broken. Status: fixed + verified (validator pass). Correction: sid-less client passes only `*-code-verifier` cookies.
- RELIABILITY-002 / RESILIENCE-003 WARNING — signOut({scope:"others"}) error ignored. Status: fixed on user request (console.error + notificar advertencia, login continues).
- RELIABILITY-003 / RESILIENCE-002 WARNING — `?sesion=cerrada` shown on transient getUser failures. Status: fixed on user request (retryable/5xx/429 → logged, no notice). Regression run: 2nd-browser kick still shows the notice (temp users created and deleted).
- Risk lens: no findings. Ack: approved (14a8639b).
- Pending manual check: end-to-end password recovery email link.
