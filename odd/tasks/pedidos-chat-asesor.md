# Bre-B follow-ups: advisor chat, receipt formats, fast access data, dev Telegram

Locator: `odd/tasks/pedidos-chat-asesor.md` · Engram mirror: `odd/pedidos-chat-asesor/tasks` (engram MCP offline this session)
Branch: `feature/pedidos-chat-asesor` (from `develop`, worktree `.claude/worktrees/chat-asesor`)

## Objective
1. Customer can chat privately with the advisor from Playr (UI in the app); the advisor gets each message in Telegram
   and answers by replying to it; the answer shows up in the customer's chat.
2. Receipt upload accepts the formats bank apps share (HEIC/HEIF, GIF besides JPG/PNG/WEBP/PDF).
3. "Ver accesos" (and staff password views) stop logging into the provider on every open: cached license list.
4. Telegram flows testable locally with a separate dev bot/group (polling), without touching production.

## Why
User request 2026-10-04 after first real test. User choices: chat = "private chat with the advisor but with our own UI";
formats = more image formats; dev = separate bot and group.

## Done before code (user-approved)
- Practice orders #7/#8 deleted, their receipts removed, profile 1 back to disponible, pedido/pedido_item sequences reset to 1.

## Tasks
- [x] T1 — Migration: mensaje_asesor (+RLS, RPCs enviar/marcar leídos), pedido tg ids, licencias cache RPCs, bucket mime types.
- [x] T2 — Receipt formats (lib/pedido + modal + Telegram sendDocument fallback + staff viewer).
- [x] T3 — License cache in resolverClaves (fresh 10 min, stale ≤24 h served + background refresh).
- [x] T4 — Chat: actions, customer chat UI in Mis compras, Telegram forward + webhook replies.
- [x] T5 — Dev bot: `.env.telegram.dev` override + polling in instrumentation (opt-in TELEGRAM_POLLING=1).
- [x] T6 — lint/tsc/build clean; chat_asesor_check + pedido_check OK; migration applied 2026-10-04; sequences reset to 1 again (checks advance them); CLAUDE.md §21; `.env.telegram.dev` template in main tree (token/chat empty → Telegram off in dev until filled).
- [x] T9 — User feedback: per-customer chats → forum topic per customer (telegram_tema) + staff inbox /administrar/mensajes (user chose option 3) + auto-refresh of Mis compras/Pedidos/Mensajes. Migrations 20261004150001/170001 applied; check OK; pedido sequence set to max+1.
- [x] T10 — User enables Topics + bot admin (manage topics) in test group, then prod group; update TELEGRAM_CHAT_ID (-100… after upgrade). Prod = -1004442187165 (local + Vercel env; needs redeploy).
- [x] T12 — Removed WhatsApp advisor number (Ajustes card, action, getWhatsappAsesor, env fallback, unused soporte-card, DB row whatsapp_asesor) — user request 2026-10-04.
- [x] T13 — Multiple Bre-B keys, customer picks one (user request 2026-10-04): business.llave_breb + RLS, crear_pedido p_llave_id (null = first visible, keeps prod working until deploy), pedido.llave_nombre; Ajustes CRUD card; Tienda radio choice; Pedidos/Telegram show key name. Migration 20261004210001 applied; ad-hoc keys check OK (pedido_check needs 2 available profiles, only 1 now).
- [x] T14 — Default Bre-B key (★, marcar_llave_predeterminada, preselected in payment) — migration 20261004220001 applied, ad-hoc check OK.
- [x] T15 — Per-key QR upload (public bucket llaves-qr, admin-only write) shown in payment modal with download — migration 20261004230001 applied, ad-hoc check OK. Generating EMVCo QR in-app rejected: tag 91 security hash unspecified.
- [x] T11 — Images + voice notes in the chat, both directions (user request 2026-10-04): migration 20261004200001 (bucket `chat`, adjunto cols, RPCs with attachment) applied; shared compositor/bubble; Telegram sendPhoto/sendVoice (document fallback) + webhook copies photo/voice/audio to bucket; check step 9 OK.
- [x] T8 — User creates dev bot+group, fills .env.telegram.dev; Claude gets chat id.
- [x] T7 — setWebhook allowed_updates [callback_query, message] (done on prod bot 2026-10-04).

## Acceptance criteria
1. lint, tsc, build clean. 2. SQL check (ROLLBACK): client sends/reads only own messages; cannot insert asesor rows.
3. Upload of .heic accepted client- and bucket-side.

## Review ledger
- base d6e15b2 · candidate 4539de5 · risk medium (executable_change) · 1011 lines · slice_budget_reached · consent granted · lens reliability.
- RELIABILITY-001 WARNING det.: poll cleared send errors → info, fixed after ack (separate load/send error state).
- RELIABILITY-002 WARNING inf.: hilo insert failure counted DM as failed → info, fixed after ack (notify instead of group fallback).
- RELIABILITY-003 WARNING: no TS unit tests for cache/format helpers → info (repo has no TS test suite).
- No blockers → ack 4539de5 approved. Post-ack fixes (~30 lines) pending in next slice (under budget).
