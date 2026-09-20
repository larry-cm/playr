// Check offline de lib.ts (sin red ni credenciales): `node supabase/functions/stock-price-watch/lib_test.ts` (Node >= 23.6)
import assert from "node:assert/strict";
import { clasificar, clave, comparar, parseConteo, parseProductos } from "./lib.ts";

const li = (cls: string, nombre: string, precio: string, agotado = false) =>
  `<li class="ast-grid-common-col product type-product post-1 ${cls}"><div>${agotado ? '<span class="ast-shop-product-out-of-stock">Agotado</span>' : ""}<h2 class="woocommerce-loop-product__title">${nombre}</h2>` +
  `<span class="price"><span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol">&#36;</span>${precio}</bdi></span></span><div class="woocommerce-loop-product__buttons"></div></div></li>`;
const html = `<p class="woocommerce-result-count" role="alert">Mostrando 1&ndash;10 de 65 resultados</p><ul class="products">${li("instock", "SPOTIFY 1 MES", "6.500")}${li("outofstock", "DISNEY GEN&Eacute;RICA PANTALLA", "1.200", true)}</ul>`;

assert.deepEqual(parseConteo(html), { porPagina: 10, total: 65 });
assert.deepEqual(parseProductos(html), [
  { nombre: "SPOTIFY 1 MES", precio: 6500, disponible: true },
  { nombre: "DISNEY GENÉRICA PANTALLA", precio: 1200, disponible: false },
]);
assert.equal(clave("z COMBO AMAZON + HBO"), clave("COMBO AMAZON + HBO"));
assert.equal(clave("FLUJO TV (COMPLETA 3 DISPOSITIVOS )"), clave("FLUJO TV (COMPLETA 3 DISPOSITIVOS)"));
assert.notEqual(clave("HBO COMPLETA"), clave("HBO PANTALLA"));

const plats = ["AMAZON", "FLUJO TV", "IPTV"];
assert.deepEqual(clasificar("z COMBO AMAZON + HBO", plats), { platform: null, access: "otro" });
assert.deepEqual(clasificar("FLUJO TV (COMPLETA 3 DISPOSITIVOS )", plats), { platform: "FLUJO TV", access: "completa" });
assert.deepEqual(clasificar("ORIGINAL IPTV PANTALLA", plats), { platform: "IPTV", access: "pantalla" });

const prev = new Map([[clave("SPOTIFY 1 MES"), { precio: 6500, disponible: true }], [clave("HBO PANTALLA"), { precio: 1500, disponible: false }]]);
const tipos = comparar(prev, [
  { nombre: "SPOTIFY 1 MES", precio: 7000, disponible: false },
  { nombre: "HBO PANTALLA", precio: 1500, disponible: true },
  { nombre: "PRODUCTO NUEVO", precio: 1, disponible: true }, // sin snapshot previo: no alerta
]).map((a) => a.tipo);
assert.deepEqual(tipos, ["agotado", "precio_cambio", "disponible"]);
console.log("lib_test ok");
