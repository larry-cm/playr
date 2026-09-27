# Feature: Clientes module (branch feat/clientes-modulo)

Status: not started — depends on the fix-auditoria-e2e-hallazgos commits.

Domain rule (user): clients = every account whose `security.user_role` is `user` (never admin/manager).

Checks: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`.

- [ ] B-T1 "Clientes" item in `app/administrar/aside.tsx`, admin/manager only.
- [ ] B-T2 List returns only role `user` accounts.
- [ ] B-T3 Create/edit from this module forces role `user` server-side.
- [ ] B-T4 Contact actions per row: WhatsApp (wa.me), call (tel:), email (mailto:), from existing phone/email; hidden/disabled when missing.

## Progress / Evidence
