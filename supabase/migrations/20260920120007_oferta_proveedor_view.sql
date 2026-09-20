-- business.oferta_proveedor: combos platform_id + access_type que el proveedor efectivamente
-- ofrece (segun el ultimo scrape), con su costo mas reciente. La usa el modulo admin de
-- productos para: (a) restringir que solo se puedan crear productos que el proveedor
-- realmente vende, y (b) autocompletar el costo — nunca se tipea a mano.
create view business.oferta_proveedor with (security_invoker = true) as
select distinct on (ml.platform_id, ml.access_type)
  ml.platform_id,
  pl.nombre as platform_nombre,
  ml.access_type,
  mls.precio as costo
from business.market_listing ml
join business.market_listing_snapshot mls on mls.listing_id = ml.id
join business.platform pl on pl.id = ml.platform_id
where ml.platform_id is not null
order by ml.platform_id, ml.access_type, mls.run_id desc;
