# Fix: UI E2E findings (branch fix/skeletons-sin-saltos)

Objective: staff pages never flash protected content to unauthorized users; the WhatsApp advisor number becomes admin-configurable at runtime; small UI/a11y fixes from the E2E run.

Checks for every task: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`.

- [x] A-T1 (B1) Role check + redirect in every `app/administrar/*/layout.tsx` whose route is staff-only (clientes, cuentas, perfiles, productos, bodega) or client-only (tienda), before PageHeader/children/loading render.
- [x] A-T2 (B2) "Rendered more hooks" when staff opens /administrar/tienda — expected to disappear with A-T1; verify.
- [x] A-T3 (B4) Mobile sidebar: page behind inert while open, focus stays in the sidebar.
- [x] A-T4 (B6) CountUp shows a placeholder, not "0", while the value is undefined.
- [x] A-T5 (B7) Productos empty search: "Ningún producto coincide con la búsqueda."
- [x] A-T6 (B8) table.tsx getFieldValidation: no hint text shown as green success.
- [x] A-T7 (B9) Perfiles/Productos row buttons include the row name in aria-label.
- [x] A-T8 (B3) WhatsApp advisor number: settings table (migration, applied by the user), admin-only write, any authenticated read, env fallback; admin settings page + aside item; Soporte and Tienda read it.

## Progress / Evidence
- 2026-09-27: all tasks implemented in worktree ../playr-fix-e2e (shared tree was switched to develop mid-run; work recovered from autostash). `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`: pass. A-T2 and the ajuste DB read/RLS not runtime-tested; migration 20260927220001_ajuste.sql pending `supabase db push` by the user, then `supabase/checks/ajuste_check.sql`.
