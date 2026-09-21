-- Amplia business.tipo_notificacion con 'info' (azul, novedades: p. ej. productos nuevos del proveedor) y 'exito'
-- (verde, buenas noticias: p. ej. volvio el stock). 'error' y 'advertencia' no cambian. Los usa la Edge Function stock-price-watch.
-- Aplicar ANTES de desplegar la funcion: sin estos valores business.notificar falla con "invalid input value for enum".
alter type business.tipo_notificacion add value if not exists 'info';
alter type business.tipo_notificacion add value if not exists 'exito';
