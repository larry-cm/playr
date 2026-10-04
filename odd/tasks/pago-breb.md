# Bre-B payment with manual verification

Locator: `odd/tasks/pago-breb.md` · Engram mirror: `odd/pago-breb/tasks` (engram MCP offline this session)
Branch: `feature/pago-breb` (from `develop`, worktree `.claude/worktrees/pago-breb`)

## Objective
Customer pays the selected profiles to the admin's Bre-B key, uploads the receipt, the order stays "pending verification"
with the profiles reserved. The advisor gets a Telegram channel post (receipt + order data + Approve/Reject buttons) and
can also review in `/administrar/pedidos`. Once approved, the customer sees the access data in "Mis compras".

## Why
User request 2026-10-03: no payment gateway (commission), manual verification; replace "Pedir por WhatsApp";
access shown in the app (user choice); Telegram notice to the advisor's channel.

## Scope (authorized)
- DB: `business.pedido`, `business.pedido_item`, profile state `reservado`, RPCs crear/aprobar/rechazar, private bucket `comprobantes`.
- Ajustes: Bre-B key (`business.ajuste` clave `llave_breb`).
- Tienda: "Pagar con Bre-B" modal (key + total + receipt upload) replaces WhatsApp button.
- Customer page "Mis compras" with access data after approval.
- Staff page "Pedidos" (receipt, approve, reject).
- Telegram: post to channel on new order, inline Approve/Reject via webhook `/api/telegram` (approver allowlist).
- Out: automatic payment detection, refunds, order expiry job.

## Tasks
- [x] T1 — Migration (tables, enum value, RPCs, RLS, bucket). Applied to prod 2026-10-03; pedido_check OK.
- [x] T2 — Bre-B key setting (lib + action + Ajustes card).
- [x] T3 — Tienda checkout modal + crear pedido action.
- [x] T4 — Mis compras (customer) + access data action.
- [x] T5 — Pedidos (staff) page + approve/reject actions.
- [x] T6 — Telegram notify + webhook. Code done; NOT tested live (no bot/channel/env yet, webhook needs public domain).
- [x] T7 — Applied `20261003190001_pedido_breb_guardas.sql` to prod (user OK 2026-10-03); pedido_check OK, no residue.
- [ ] T8 — Waiting on user (2026-10-03): once this branch is live on Vercel (https://playr-eight.vercel.app), add the 4 TELEGRAM_* vars with `vercel env add <NAME> production --force` (.vercelignore excludes .env*), redeploy, then setWebhook to `/api/telegram` with secret_token = TELEGRAM_WEBHOOK_SECRET. Bot+group connected, test message sent (group -5420743488).

## Review ledger
- base 69f6e7c · candidate 3820f6d · risk high (hot_path update/webhook/payments) · 3 lenses · consent granted.
- RESILIENCE-001 CRITICAL deterministic: orphan payment when crear_pedido fails after transfer → fixed (bell "Comprobante sin pedido" + customer notice) → verified.
- RELIABILITY-001 CRITICAL deterministic: reserved profile editable → double sale → fixed (trigger profile_guarda_reservado + aprobar checks all reserved) → verified.
- RELIABILITY-002 WARNING: price change between view and submit → fixed (p_total_esperado). RISK-001 WARNING: receipt reuse → fixed (unique comprobante_path).
- RELIABILITY-003 SUGGESTION: check coverage → partially (new steps); info.
- Correction tree a4e45d5 · validator pass · ack approved.
- Follow-ups (info): DELETE of reserved profile not guarded; thrown rpc exception skips orphan notice; decimal totals compare exactly.

## Acceptance criteria
1. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` clean.
2. SQL check (ROLLBACK) proves: client creates order → profiles reservado and gone from catalog; client cannot approve;
   staff approve → vendido; reject → disponible; client only sees own orders.

## Next step
T1.
