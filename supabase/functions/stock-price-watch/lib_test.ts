// Check offline de lib.ts (sin red ni credenciales): `node supabase/functions/stock-price-watch/lib_test.ts` (Node >= 23.6)
import assert from "node:assert/strict";
import { cambiosDeStock, clasificar, clave, comparar, llave, parseConteo, parseProductos } from "./lib.ts";

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
// cambiosDeStock: solo productos vendidos y por stock agregado (un hermano disponible tapa al agotado)
const L = new Map([["A1", "1|pantalla"], ["A2", "1|pantalla"], ["B", "2|completa"], ["C", "3|completa"]].map(([n, k]) => [clave(n), k]));
const st = (n: string, disponible: boolean) => [clave(n), { precio: 1, disponible }] as const;
const pr = (nombre: string, disponible: boolean) => ({ nombre, precio: 1, disponible });
const vend = new Set([llave(1, "pantalla"), llave(2, "completa")]);
const c1 = cambiosDeStock(new Map([st("A1", true), st("A2", true), st("B", true), st("C", true)]), [pr("A1", false), pr("A2", true), pr("B", false), pr("C", false)], L, vend);
assert.deepEqual(c1, { agotados: ["2|completa"], vuelven: [] }); // A1 agotado pero A2 sigue; C no se vende
const c2 = cambiosDeStock(new Map([st("A1", false), st("A2", false), st("B", true)]), [pr("A1", true), pr("A2", false), pr("B", true)], L, vend);
assert.deepEqual(c2, { agotados: [], vuelven: ["1|pantalla"] });
console.log("lib_test ok");
