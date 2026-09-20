// Runtime-neutral (Node 24 / Deno / Supabase Edge): solo fetch + regex, sin DOM ni librerias.
// Lo importan index.ts (Edge Function) y el sandbox, asi lo probado es exactamente lo desplegado.

export type Producto = { nombre: string; precio: number; disponible: boolean };
export type Estado = { precio: number; disponible: boolean };
export type Alerta = { nombre: string; tipo: "agotado" | "disponible" | "precio_cambio"; anterior: string; nuevo: string };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const ENT: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", iexcl: "¡", iquest: "¿", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
};
const decode = (s: string) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, d, h, n) =>
    d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : (ENT[n] ?? m));
const limpiar = (s: string) => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
// Identidad de un producto = titulo sin mayusculas, sin el prefijo "z " de los combos (el sitio lo usa para ordenarlos al final),
// sin espacios ni signos. El seed y el sitio difieren en eso ("( SI ... )" vs "(SI ...)"), y un retoque cosmetico futuro del
// sitio no debe crear un listing duplicado (que dejaria al producto viejo sin alertas).
export const clave = (s: string) => s.toUpperCase().replace(/^Z\s+(?=COMBO\b)/, "").replace(/[^\p{L}\p{N}+]/gu, "");

// es-CO: punto = miles, coma = decimal ("$9.000" = 9000)
export function parsePrecio(t: string): number {
  const s = t.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) throw new Error(`precio ilegible: "${t}"`);
  return Number(s.replace(/\./g, "").replace(",", "."));
}

export function parseConteo(html: string): { porPagina: number; total: number } {
  const m = html.match(/<p[^>]*class="woocommerce-result-count"[^>]*>([\s\S]*?)<\/p>/);
  const n = m ? limpiar(m[1]).match(/\d+/g)?.map(Number) : undefined;
  if (!n?.length) throw new Error("no encontre 'Mostrando X–Y de T resultados' (cambio el sitio?)");
  return n.length >= 3 ? { porPagina: n[1] - n[0] + 1, total: n[2] } : { porPagina: n[0], total: n[0] };
}

export function parseProductos(html: string): Producto[] {
  const ini = html.indexOf('<ul class="products');
  if (ini < 0) return [];
  const fin = html.indexOf("</ul>", ini);
  const out: Producto[] = [];
  for (const chunk of html.slice(ini, fin < 0 ? undefined : fin).split(/<li\b(?=[^>]*\btype-product\b)/).slice(1)) {
    const titulo = chunk.match(/woocommerce-loop-product__title[^>]*>([\s\S]*?)<\/h2>/);
    if (!titulo) throw new Error("producto sin titulo (cambio el marcado del sitio?)");
    const p = chunk.indexOf('class="price"');
    const seg = p < 0 ? "" : chunk.slice(p, chunk.indexOf("<div", p) < 0 ? undefined : chunk.indexOf("<div", p));
    const montos = [...seg.matchAll(/<bdi>([\s\S]*?)<\/bdi>/g)];
    if (!montos.length) throw new Error(`sin precio: ${limpiar(titulo[1])}`);
    const agotado = /\boutofstock\b/.test(chunk.slice(0, chunk.indexOf(">"))) || chunk.slice(0, titulo.index).includes("ast-shop-product-out-of-stock");
    // ponytail: con oferta (<del>/<ins>) o rango toma el ultimo monto; revisar si el proveedor usa ofertas/variables
    out.push({ nombre: limpiar(titulo[1]), precio: parsePrecio(limpiar(montos[montos.length - 1][1])), disponible: !agotado });
  }
  return out;
}

export type Cfg = { base: string; storePath: string; email: string; password: string };

export async function scrapeCatalog(c: Cfg) {
  const base = c.base.replace(/\/+$/, "");
  const jar = new Map<string, string>();
  const ms = { login: 0, fetch: 0, parse: 0 };
  const get = async (url: string, init: RequestInit = {}) => {
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": UA, "accept-language": "es-CO,es;q=0.9", cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), ...init.headers },
    });
    for (const s of res.headers.getSetCookie()) {
      const kv = s.split(";")[0];
      const i = kv.indexOf("=");
      jar.set(kv.slice(0, i).trim(), kv.slice(i + 1));
    }
    return res;
  };
  const page = async (url: string) => {
    const t = performance.now();
    const res = await get(url);
    if (!res.ok) throw new Error(`${new URL(url).pathname} -> HTTP ${res.status}`);
    const html = await res.text();
    ms.fetch += performance.now() - t;
    return html;
  };

  // 1) login en frio (Ultimate Member sobre WordPress): se reenvian todos los campos del form, hidden incluidos (nonce, referer)
  const t0 = performance.now();
  const loginUrl = base + "/login/"; // ponytail: ruta fija; si cambia, el error de abajo lo dice
  const html = await page(loginUrl);
  const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].map((m) => m[0]).find((f) => /type=["']password["']/i.test(f));
  if (!form) throw new Error("login: no hay form con password en /login/ (cambio el sitio?)");
  const attr = (tag: string, n: string) => tag.match(new RegExp(`\\b${n}=["']([^"']*)["']`, "i"))?.[1];
  const body = new URLSearchParams();
  for (const [tag] of form.matchAll(/<input\b[^>]*>/gi)) {
    const name = attr(tag, "name");
    const type = (attr(tag, "type") ?? "text").toLowerCase();
    if (!name || type === "checkbox" || type === "submit") continue;
    body.set(name, type === "password" ? c.password : type === "text" || type === "email" ? c.email : decode(attr(tag, "value") ?? ""));
  }
  const action = new URL(attr(form.match(/<form\b[^>]*>/i)![0], "action") || "/login/", loginUrl).href;
  const post = await get(action, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", origin: base, referer: loginUrl } });
  await post.arrayBuffer();
  if (![...jar.keys()].some((k) => k.startsWith("wordpress_logged_in_"))) throw new Error(`login fallo (HTTP ${post.status}): sin cookie wordpress_logged_in_*`);
  ms.login = performance.now() - t0;

  // 2) tienda: pagina 1 -> total -> resto (secuencial, ponytail: en paralelo si el tiempo total molesta)
  const store = base + "/" + c.storePath.replace(/^\/+|\/+$/g, "") + "/";
  const p1 = await page(store);
  const { porPagina, total } = parseConteo(p1);
  const htmls = [p1];
  for (let n = 2; n <= Math.ceil(total / porPagina); n++) htmls.push(await page(`${store}page/${n}/`));
  const tp = performance.now();
  const productos = htmls.flatMap(parseProductos);
  ms.parse = performance.now() - tp;

  // 3) guardas: nada se persiste si esto falla
  if (productos.length !== total) throw new Error(`parseados ${productos.length} != total publicado ${total}`);
  if (new Set(productos.map((p) => clave(p.nombre))).size !== total) throw new Error("nombres de producto duplicados");
  return { total, porPagina, productos, ms };
}

// plataforma = la de nombre mas largo contenido como palabra en el titulo; COMBO => null (varias marcas)
export function clasificar(nombre: string, plataformas: string[]): { platform: string | null; access: "completa" | "pantalla" | "otro" } {
  const n = ` ${nombre.toUpperCase().replace(/[()[\],.:;]/g, " ").replace(/\s+/g, " ")} `;
  const access = / COMPLETA /.test(n) ? "completa" : / PANTALLA /.test(n) ? "pantalla" : "otro";
  if (/ COMBO /.test(n)) return { platform: null, access };
  const hit = plataformas.filter((p) => n.includes(` ${p.toUpperCase()} `)).sort((a, b) => b.length - a.length)[0];
  return { platform: hit ?? null, access };
}

// prev: estado de la corrida anterior indexado por clave(nombre)
export function comparar(prev: Map<string, Estado>, actual: Producto[]): Alerta[] {
  const out: Alerta[] = [];
  for (const p of actual) {
    const o = prev.get(clave(p.nombre));
    if (!o) continue; // nuevo o sin snapshot previo: sin alerta
    if (o.disponible && !p.disponible) out.push({ nombre: p.nombre, tipo: "agotado", anterior: "disponible", nuevo: "agotado" });
    if (!o.disponible && p.disponible) out.push({ nombre: p.nombre, tipo: "disponible", anterior: "agotado", nuevo: "disponible" });
    if (o.precio !== p.precio) out.push({ nombre: p.nombre, tipo: "precio_cambio", anterior: String(o.precio), nuevo: String(p.precio) });
  }
  return out;
}

export const llave = (platformId: number | null, access: string) => `${platformId}|${access}`;

// Stock por producto vendido (llave platform_id|access_type): hay stock si ALGUN listing del proveedor esta disponible, asi un hermano
// agotado no da falsa alarma. Devuelve las llaves (ordenadas) cuyo stock cambio entre la corrida anterior y esta.
export function cambiosDeStock(prev: Map<string, Estado>, actual: Producto[], llavePorClave: Map<string, string>, vendidos: Set<string>) {
  const st = new Map<string, { antes: boolean; ahora: boolean }>();
  for (const p of actual) {
    const c = clave(p.nombre), k = llavePorClave.get(c);
    if (!k || !vendidos.has(k)) continue;
    const s = st.get(k) ?? { antes: false, ahora: false };
    s.antes ||= prev.get(c)?.disponible ?? false;
    s.ahora ||= p.disponible;
    st.set(k, s);
  }
  const con = (f: (s: { antes: boolean; ahora: boolean }) => boolean) => [...st].filter(([, s]) => f(s)).map(([k]) => k).sort();
  return { agotados: con((s) => s.antes && !s.ahora), vuelven: con((s) => !s.antes && s.ahora) };
}
