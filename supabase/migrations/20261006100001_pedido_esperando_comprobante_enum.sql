-- Pago por QR desde el chat con el asesor (pedido del usuario 2026-10-04): el pedido se crea antes del comprobante y
-- queda 'esperando_comprobante' con sus perfiles apartados hasta que el cliente manda el comprobante por el chat.
-- El valor nuevo del enum va solo en esta migración: Postgres no deja usar un valor agregado con ADD VALUE dentro de la
-- misma transacción, y cada migración corre en la suya. Lo usa 20261006100002_pedido_qr_chat.sql.

alter type business.estado_pedido add value if not exists 'esperando_comprobante';
