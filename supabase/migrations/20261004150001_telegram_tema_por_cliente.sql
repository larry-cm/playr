-- Un tema (hilo de un grupo de Telegram con Temas) por cliente: ahí llegan sus mensajes y los avisos de sus pedidos, y
-- todo lo que el asesor escribe en ese tema le llega al cliente, sin tener que responder un mensaje en particular.
-- Lo escribe y lee solo el servidor (service_role).

create table business.telegram_tema (
  cliente_id uuid primary key references auth.users(id),
  chat_id bigint not null,
  thread_id bigint not null,
  created_at timestamptz not null default now(),
  unique (chat_id, thread_id)
);

alter table business.telegram_tema enable row level security;
revoke all on business.telegram_tema from public, anon, authenticated;
grant select, insert, update, delete on business.telegram_tema to service_role;
