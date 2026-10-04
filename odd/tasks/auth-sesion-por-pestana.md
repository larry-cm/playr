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

- [x] T4 — Clean URLs (user request 2026-10-03: "/s/id" visible is ugly): session moves to per-tab sessionStorage; token travels in header `x-playr-token` (fetch patch) or 10 s `beforeunload` hint cookie on full loads; proxy validates; login returns session to the tab; duplicate-tab detection via BroadcastChannel; prefix helpers become identity (a git checkout revert of the 25 prefixed files was denied by the permission classifier). Route: inline. Risk: high.

- [x] T5 — Fix review-3 warnings (user request): transient Auth failures (esFallaTransitoria: retryable/5xx/429) never wipe the tab session on the login restore; setSession failure after login shows an error; hint cookie cleared on pagehide so a closed tab does not leave it. Route: inline. Risk: high.

- [x] T6 — Bug reported by user: Chrome "Duplicate tab" kept the same session. Cause: a tab that started without a tab id (fresh login tab) never opened the BroadcastChannel responder, so its copies got no answer. Fix: the channel always opens; verification starts at module load (sesion-fetch). Route: inline. Risk: high.

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

- T4: tsc OK, lint OK, build OK. Browser (next start :3107, agent-browser, 2 temp users created+deleted): URLs are /administrar/...; tab A=user A and tab B=user B; reloads load directly (navigation redirectCount 0); new tab typed URL → login; simulated duplicate (copied sessionStorage) → login without session while the original keeps its session; 2nd browser login kicks tab A on next nav with notice, tab B (other account) unaffected; logout clears tab storage. Finding: Chrome sends the reload request before pagehide → hint set in beforeunload.

- T5: tsc OK, lint OK, build OK. Browser (temp users created+deleted): reload loads directly (redirectCount 0) and no hint cookie remains; after closing a logged-in tab no hint cookie remains and a new tab on /administrar gets login; Auth /user aborted on restore → session kept + "No se pudo verificar tu sesión" notice, then restored when Auth is back; Auth /user aborted during login → "Iniciaste sesión, pero no se pudo abrir en esta pestaña"; 2nd-browser kick still shows notice. Not simulable with agent-browser: HTTP 500/429 bodies (same code path via esFallaTransitoria).

- T6: tsc OK, lint OK, build OK. Browser: fresh login tab (never reloaded) → copy via window.open (Chrome copies sessionStorage) lands on login without session; manual sessionStorage copy of a fresh tab → login without session; originals keep their sessions. Real Chrome "Duplicate" menu not automatable: pending user check.

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
