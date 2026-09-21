// Cliente HTTP (fetch + regex, sin navegador ni DOM) de la cuenta en tuproveedor2.com (WordPress + WooCommerce + Ultimate Member
// + TeraWallet + License Manager). Mismo enfoque que app/lib/scrape-licencias.ts y la Edge Function stock-price-watch: el login
// se reutiliza de scrape-licencias; las paginas se parsean con regex sobre el HTML real del sitio.
//
// Seguridad de dinero: aca NUNCA se decide comprar. Estas funciones solo leen y ejecutan pasos sueltos; el orden y las guardas
// (saldo, precio, carrito ajeno, un solo item, pago solo con monedero) viven en compra.ts.

import { decode, limpiar, loginUltimateMember, parseFechaEs, UA } from "@lib/scrape-licencias"

export type CodigoError =
    | "config" | "login" | "sitio" | "saldo" | "producto" | "agotado" | "precio" | "carrito" | "checkout"
    | "pago"      // el proveedor RECHAZO el pedido: no se cobro nada
    | "incierto"  // no se sabe si el pago se hizo: NO reintentar sin verificar en el proveedor

export class ProveedorError extends Error {
    constructor(message: string, readonly codigo: CodigoError, readonly precioActual?: number) {
        super(message)
        this.name = "ProveedorError"
    }
}

export interface ProveedorCfg {
    base: string
    /** "/tienda" (sin barra final). */
    storePath: string
    email: string
    password: string
}

export function cfgProveedor(env: Record<string, string | undefined> = process.env): ProveedorCfg | null {
    const base = env.PLATFORM_URL
    const email = env.PLATFORM_EMAIL
    const password = env.PLATFORM_PASSWORD
    if (!base || !email || !password) return null
    return {
        base: base.replace(/\/+$/, ""),
        storePath: "/" + (env.PLATFORM_STORE_PATH ?? "tienda").replace(/^\/+|\/+$/g, ""),
        email,
        password,
    }
}

// ---- sesion -------------------------------------------------------------------------------------------------------

export interface Sesion {
    cfg: ProveedorCfg
    get: (url: string, init?: RequestInit) => Promise<Response>
}

/** Login en frio (cada compra abre su propia sesion: nunca se reusan cookies ni nonces viejos). */
export async function conectar(cfg: ProveedorCfg, timeoutMs = 20_000): Promise<Sesion> {
    const jar = new Map<string, string>()
    try {
        await loginUltimateMember(cfg.base, cfg.email, cfg.password, jar)
    } catch (e) {
        throw new ProveedorError(e instanceof Error ? e.message : "No pude iniciar sesión en el proveedor.", "login")
    }
    const get = async (url: string, init: RequestInit = {}) => {
        const res = await fetch(url.startsWith("http") ? url : cfg.base + url, {
            ...init,
            redirect: "manual",
            signal: init.signal ?? AbortSignal.timeout(timeoutMs),
            headers: { "user-agent": UA, "accept-language": "es-CO,es;q=0.9", cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), ...init.headers },
        })
        for (const s of res.headers.getSetCookie()) {
            const kv = s.split(";")[0]
            const i = kv.indexOf("=")
            jar.set(kv.slice(0, i).trim(), kv.slice(i + 1))
        }
        return res
    }
    return { cfg, get }
}

async function pagina(s: Sesion, url: string, init?: RequestInit) {
    const res = await s.get(url, init)
    return { status: res.status, location: res.headers.get("location"), html: await res.text() }
}

// ---- utilidades ---------------------------------------------------------------------------------------------------

/** es-CO: el punto separa miles y la coma es decimal ("$9.000" = 9000). */
export function parsePrecio(t: string): number {
    const s = t.replace(/[^\d.,]/g, "")
    const n = Number(s.replace(/\./g, "").replace(",", "."))
    if (!/\d/.test(s) || !Number.isFinite(n)) throw new Error(`precio ilegible: "${t}"`)
    return n
}

/** Misma identidad de producto que usa el cron (stock-price-watch/lib.ts): sin mayusculas, sin el "z " de combos, sin espacios ni signos. */
export const clave = (s: string) => s.toUpperCase().replace(/^Z\s+(?=COMBO\b)/, "").replace(/[^\p{L}\p{N}+]/gu, "")

/** Valor de un atributo HTML de una etiqueta suelta: attr('<input name="x">', "name") -> "x". */
const attr = (tag: string, n: string) => new RegExp(`\\b${n}=["']([^"']*)["']`, "i").exec(tag)?.[1]

const bdi = (html: string) => {
    const m = /<bdi>([\s\S]*?)<\/bdi>/.exec(html)
    return m ? parsePrecio(limpiar(m[1])) : null
}

/** Fecha "octubre 20, 2026 ..." -> "2026-10-20" (los campos locales que armo parseFechaEs, sin desfase de zona horaria). */
function fechaISO(texto: string): string | null {
    const d = parseFechaEs(texto)
    return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null
}

// ---- saldo --------------------------------------------------------------------------------------------------------

export function parseSaldo(html: string): number | null {
    const card = /woo-wallet-balance-card[\s\S]*?<p class="woo-wallet-price">([\s\S]*?)<\/p>/.exec(html)
    return card ? bdi(card[1]) : null
}

export async function leerSaldo(s: Sesion): Promise<number> {
    const { status, html } = await pagina(s, "/mi-cuenta/my-wallet/")
    const saldo = status === 200 ? parseSaldo(html) : null
    if (saldo === null) throw new ProveedorError("No pude leer el saldo del monedero del proveedor (¿cambió el sitio?).", "saldo")
    return saldo
}

// ---- tienda -------------------------------------------------------------------------------------------------------

export interface ProductoTienda {
    id: number
    nombre: string
    precio: number
    enStock: boolean
    /** Producto simple y comprable: sin variaciones ni campos extra que elegir. */
    comprable: boolean
    /** Unidades disponibles (el tope del selector de cantidad de la ficha), o null si el sitio no lo informa. */
    stockMax: number | null
    /** Enlace a la ficha del producto (solo viene de los listados). */
    url: string | null
}

export function parseListado(html: string): ProductoTienda[] {
    const ini = html.indexOf('<ul class="products')
    if (ini < 0) return []
    const fin = html.indexOf("</ul>", ini)
    const out: ProductoTienda[] = []
    for (const chunk of html.slice(ini, fin < 0 ? undefined : fin).split(/<li\b(?=[^>]*\btype-product\b)/).slice(1)) {
        const head = chunk.slice(0, chunk.indexOf(">"))
        const titulo = /woocommerce-loop-product__title[^>]*>([\s\S]*?)<\/h2>/.exec(chunk)
        const id = /data-product_id="(\d+)"/.exec(chunk)?.[1] ?? /\bpost-(\d+)\b/.exec(head)?.[1]
        const p = chunk.indexOf('class="price"')
        const seg = p < 0 ? "" : chunk.slice(p, chunk.indexOf("<div", p) < 0 ? undefined : chunk.indexOf("<div", p))
        const montos = [...seg.matchAll(/<bdi>([\s\S]*?)<\/bdi>/g)]
        if (!titulo || !id || montos.length === 0) continue
        const agotado = /\boutofstock\b/.test(head) || chunk.slice(0, titulo.index).includes("ast-shop-product-out-of-stock")
        out.push({
            id: Number(id),
            nombre: limpiar(titulo[1]),
            // con oferta (<del>/<ins>) o rango se toma el ultimo monto: el vigente
            precio: parsePrecio(limpiar(montos[montos.length - 1][1])),
            enStock: !agotado,
            comprable: /\bpurchasable\b/.test(head) && /\bproduct-type-simple\b/.test(head),
            stockMax: null,
            url: /href="([^"]*\/producto\/[^"]*)"/.exec(chunk)?.[1] ?? null,
        })
    }
    return out
}

/**
 * Ficha de UN producto (la fuente de verdad: precio, stock y que se pueda comprar sin elegir nada). Se considera comprable solo si
 * su formulario de compra es el simple: cantidad + "Añadir al carrito", sin variaciones ni campos extra. Sin formulario (agotado)
 * o con opciones, no se compra desde aqui.
 */
export function parseFicha(html: string): ProductoTienda | null {
    const titulo = /<h1[^>]*product_title[^>]*>([\s\S]*?)<\/h1>/.exec(html)
    const p = html.indexOf('<p class="price">')
    const precio = p < 0 ? [] : [...html.slice(p, html.indexOf("</p>", p)).matchAll(/<bdi>([\s\S]*?)<\/bdi>/g)]
    if (!titulo || precio.length === 0) return null

    const form = /<form\b[^>]*class="[^"]*\bcart\b[^"]*"[\s\S]*?<\/form>/.exec(html)?.[0] ?? ""
    const id = /name="add-to-cart"[^>]*value="(\d+)"/.exec(form)?.[1] ?? /\bpostid-(\d+)\b/.exec(html)?.[1]
    if (!id) return null

    const tags = [...form.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)].map((m) => m[0])
    const cantidad = tags.find((t) => attr(t, "name") === "quantity")
    const max = cantidad ? Number(attr(cantidad, "max")) : NaN
    // todo lo que el cliente tendria que llenar/elegir (opciones, notas, datos del cliente): hoy el sitio no tiene ninguno
    const extra = tags.filter((t) => {
        const name = attr(t, "name") ?? ""
        const type = (attr(t, "type") ?? "text").toLowerCase()
        return !["quantity", "add-to-cart", "product_id", "variation_id"].includes(name) && !["hidden", "submit", "button"].includes(type)
    })
    const variable = /\bvariations_form\b/.test(form)
    const agotado = /class="stock out-of-stock"/.test(html) || !/name="add-to-cart"/.test(form)

    return {
        id: Number(id),
        nombre: limpiar(titulo[1]),
        precio: parsePrecio(limpiar(precio[precio.length - 1][1])),
        enStock: !agotado,
        comprable: !agotado && !variable && extra.length === 0,
        stockMax: Number.isInteger(max) && max > 0 ? max : null,
        url: null,
    }
}

/** Sigue solo redirecciones al MISMO sitio y a una ficha de producto. */
function urlDeFicha(s: Sesion, destino: string): string {
    const abs = new URL(destino, s.cfg.base)
    if (abs.origin !== new URL(s.cfg.base).origin || !abs.pathname.includes("/producto/"))
        throw new ProveedorError("El proveedor llevó la búsqueda a una página inesperada. No se compra nada.", "sitio")
    return abs.href
}

async function leerFicha(s: Sesion, url: string): Promise<ProductoTienda | null> {
    const { status, html } = await pagina(s, url)
    if (status !== 200) throw new ProveedorError(`No pude abrir la ficha del producto (HTTP ${status}).`, "sitio")
    return parseFicha(html)
}

function paginas(html: string): number {
    const m = /<p[^>]*class="woocommerce-result-count"[^>]*>([\s\S]*?)<\/p>/.exec(html)
    const n = m ? limpiar(m[1]).match(/\d+/g)?.map(Number) : undefined
    if (!n?.length) return 1
    return n.length >= 3 ? Math.ceil(n[2] / (n[1] - n[0] + 1)) : 1
}

/**
 * Ubica el producto EN VIVO por su nombre y lee su ficha (la fuente de verdad del precio, el stock y si se puede comprar sin elegir
 * nada: la DB puede tener retraso). Coincide por clave() y debe haber exactamente uno: si no, no se compra nada.
 */
export async function buscarProducto(s: Sesion, nombre: string): Promise<ProductoTienda> {
    const objetivo = clave(nombre)
    const q = nombre.replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim()
    const rutas = [`${s.cfg.storePath}/?s=${encodeURIComponent(q)}&post_type=product`]
    const noEncontrado = () => new ProveedorError(`No encontré "${nombre}" en la tienda del proveedor. Puede que haya cambiado de nombre o ya no se venda.`, "producto")

    // WooCommerce lleva DIRECTO a la ficha (302) cuando la busqueda tiene un unico resultado; con varios muestra el listado.
    const primera = await pagina(s, rutas[0])
    let fichaUrl: string | null
    if (primera.status >= 300 && primera.status < 400 && primera.location) {
        fichaUrl = urlDeFicha(s, primera.location)
    } else {
        let hallados: ProductoTienda[] = []
        for (let i = 0; i < rutas.length && hallados.length === 0; i++) {
            const { status, html } = i === 0 ? primera : await pagina(s, rutas[i])
            if (status !== 200) throw new ProveedorError(`No pude consultar la tienda del proveedor (HTTP ${status}).`, "sitio")
            hallados = parseListado(html).filter((p) => clave(p.nombre) === objetivo)
            if (i === 0) for (let n = 2; n <= Math.min(paginas(html), 4); n++) rutas.push(`${s.cfg.storePath}/page/${n}/?s=${encodeURIComponent(q)}&post_type=product`)
        }
        if (hallados.length === 0) throw noEncontrado()
        if (hallados.length > 1) throw new ProveedorError(`"${nombre}" coincide con ${hallados.length} productos del proveedor; no se compra a ciegas.`, "producto")
        fichaUrl = hallados[0].url ? urlDeFicha(s, hallados[0].url) : null
    }
    if (!fichaUrl) throw noEncontrado()

    const ficha = await leerFicha(s, fichaUrl)
    // el unico resultado de una busqueda puede ser un producto PARECIDO (p. ej. "HBO PANTALLA PLUS"): el titulo de la ficha manda
    if (!ficha || clave(ficha.nombre) !== objetivo) throw noEncontrado()
    return ficha
}

// ---- carrito y checkout -------------------------------------------------------------------------------------------

export interface LineaCheckout {
    nombre: string
    cantidad: number
    total: number | null
}

export interface CheckoutLeido {
    url: string
    /** Lo que REALMENTE se pagaria: las filas de la tabla de resumen del pedido. Vacio = carrito vacio. */
    lineas: LineaCheckout[]
    total: number | null
    metodos: { id: string; marcado: boolean }[]
    /** "Saldo en Cartera: $ X" que el propio checkout muestra junto al medio de pago. */
    saldoMostrado: number | null
    /** Campos que enviaria el navegador (ocultos y de texto ya rellenados): nonce, referer... */
    campos: { name: string; value: string }[]
    /** Campos VISIBLES obligatorios (o terminos) que no sabemos llenar: si hay alguno el producto pide datos extra y no se paga. */
    requeridosExtra: string[]
    /** Enlaces para quitar items del carrito, con el producto al que pertenece cada uno. */
    quitar: { productId: number | null; url: string }[]
}

export function parseCheckout(html: string, url = ""): CheckoutLeido {
    const form = /<form\b[^>]*name="checkout"[\s\S]*?<\/form>/.exec(html)?.[0] ?? ""

    const lineas: LineaCheckout[] = [...form.matchAll(/<tr class="cart_item">([\s\S]*?)<\/tr>/g)].map((m) => {
        const nombreTd = /class="product-name">([\s\S]*?)<\/td>/.exec(m[1])?.[1] ?? ""
        return {
            nombre: limpiar(nombreTd.replace(/<strong class="product-quantity">[\s\S]*?<\/strong>/, "")),
            cantidad: Number(/product-quantity">[^\d]*(\d+)/.exec(nombreTd)?.[1] ?? 1),
            total: bdi(/class="product-total">([\s\S]*?)<\/td>/.exec(m[1])?.[1] ?? ""),
        }
    })
    const total = bdi(/<tr class="order-total">([\s\S]*?)<\/tr>/.exec(form)?.[1] ?? "")

    const metodos = [...form.matchAll(/<li class="wc_payment_method[^"]*">([\s\S]*?)<\/li>/g)].flatMap((m) => {
        const input = /<input\b[^>]*name="payment_method"[^>]*>/.exec(m[1])?.[0]
        return input ? [{ id: attr(input, "value") ?? "", marcado: /\bchecked\b/.test(input) }] : []
    })
    const label = /<label for="payment_method_wallet">([\s\S]*?)<\/label>/.exec(form)?.[1]
    const saldoMostrado = label ? bdi(label) : null

    const campos: { name: string; value: string }[] = []
    const requeridosExtra: string[] = []
    for (const [tag] of form.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)) {
        const name = attr(tag, "name")
        const type = (attr(tag, "type") ?? "text").toLowerCase()
        if (!name || ["radio", "submit", "button", "image", "file"].includes(type)) continue
        if (type === "checkbox") {
            if (name === "terms" || /\brequired\b|aria-required=["']true/.test(tag)) requeridosExtra.push(name)
            continue
        }
        if (type !== "hidden" && (/\brequired\b|aria-required=["']true/.test(tag) || new RegExp(`id=["']${name}_field["'][^>]*validate-required`).test(form))) requeridosExtra.push(name)
        campos.push({ name, value: decode(attr(tag, "value") ?? "") })
    }
    if (/<p[^>]*validate-required/.test(form) && requeridosExtra.length === 0) requeridosExtra.push("(campos obligatorios)")

    const quitar = [...html.matchAll(/<a\b[^>]*remove_item=[^>]*>/g)].flatMap((m) => {
        const url = decode(attr(m[0], "href") ?? "")
        const id = /data-product_id="(\d+)"/.exec(m[0])?.[1]
        return url ? [{ productId: id ? Number(id) : null, url }] : []
    })

    return { url, lineas, total, metodos, saldoMostrado, campos, requeridosExtra, quitar }
}

export async function leerCheckout(s: Sesion, url = "/finalizar-compra/"): Promise<CheckoutLeido> {
    const { status, html } = await pagina(s, url)
    if (status !== 200) throw new ProveedorError(`No pude abrir el checkout del proveedor (HTTP ${status}).`, "checkout")
    return parseCheckout(html, url.startsWith("http") ? url : s.cfg.base + url)
}

/** Agrega al carrito con el mismo GET que dispara el boton "Comprar" de la tienda. Devuelve el checkout al que redirige el sitio. */
export async function agregarAlCarrito(s: Sesion, productId: number, cantidad: number): Promise<string | null> {
    const res = await s.get(`${s.cfg.base}${s.cfg.storePath}/?add-to-cart=${productId}&quantity=${cantidad}`)
    await res.arrayBuffer()
    if (res.status >= 400) throw new ProveedorError(`No pude agregar el producto al carrito (HTTP ${res.status}).`, "carrito")
    return res.headers.get("location")
}

/**
 * Quita del carrito SOLO el producto indicado (lo que este flujo agrego); jamas lo que no es suyo (otra sesion o compra manual en
 * la misma cuenta). Verifica en el checkout, que refleja el carrito real. Devuelve true si ese producto ya no esta.
 */
export async function quitarDelCarrito(s: Sesion, productId: number): Promise<boolean> {
    for (let intento = 0; intento < 3; intento++) {
        const propios = (await leerCheckout(s)).quitar.filter((q) => q.productId === productId)
        if (propios.length === 0) return true
        for (const q of propios) await (await s.get(q.url)).arrayBuffer()
    }
    return (await leerCheckout(s)).quitar.every((q) => q.productId !== productId)
}

// ---- pago ---------------------------------------------------------------------------------------------------------

/**
 * Envia el pedido igual que el JS del checkout: POST a /?wc-ajax=checkout con los campos del formulario, pagando SOLO con el
 * monedero. Un rechazo explicito ("pago") no cobra nada; cualquier otra cosa (timeout, HTML, JSON raro) es "incierto": el
 * llamador NO debe reintentar sin verificar en el proveedor.
 */
export async function pagarConMonedero(s: Sesion, co: CheckoutLeido): Promise<{ pedidoId: number }> {
    const body = new URLSearchParams()
    for (const c of co.campos) body.set(c.name, c.value)
    body.set("payment_method", "wallet")

    let status = 0
    let texto = ""
    try {
        const res = await s.get(`${s.cfg.base}/?wc-ajax=checkout`, {
            method: "POST",
            body,
            signal: AbortSignal.timeout(45_000),
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "x-requested-with": "XMLHttpRequest",
                accept: "application/json, text/javascript, */*; q=0.01",
                origin: s.cfg.base,
                referer: co.url,
            },
        })
        status = res.status
        texto = await res.text()
    } catch {
        throw new ProveedorError("No recibí respuesta del proveedor al pagar: no sé si el pedido se hizo.", "incierto")
    }

    let json: { result?: string; redirect?: string; messages?: string } | null = null
    const a = texto.indexOf("{")
    const b = texto.lastIndexOf("}")
    if (a >= 0 && b > a) {
        try {
            json = JSON.parse(texto.slice(a, b + 1))
        } catch {
            json = null
        }
    }
    if (!json) throw new ProveedorError(`Respuesta inesperada del proveedor al pagar (HTTP ${status}): no sé si el pedido se hizo.`, "incierto")

    if (json.result === "success") {
        const id = /order-received\/(\d+)/.exec(json.redirect ?? "")?.[1] ?? /[?&]order-received=(\d+)/.exec(json.redirect ?? "")?.[1]
        if (!id) throw new ProveedorError("El proveedor confirmó el pago pero no pude leer el número de pedido.", "incierto")
        return { pedidoId: Number(id) }
    }
    if (json.result === "failure") throw new ProveedorError(limpiar(json.messages ?? "") || "El proveedor rechazó el pedido.", "pago")
    throw new ProveedorError("Respuesta desconocida del proveedor al pagar: no sé si el pedido se hizo.", "incierto")
}

// ---- entrega ------------------------------------------------------------------------------------------------------

export interface LicenciaProveedor {
    licenciaId: number | null
    pedidoId: number | null
    producto: string
    texto: string
    vence: string | null
}

/** Todas las licencias de "Mis licencias" con el pedido al que pertenece cada una (asi se identifican EXACTAMENTE las de una compra). */
export function parseLicencias(html: string): LicenciaProveedor[] {
    const out: LicenciaProveedor[] = []
    for (const block of html.split('<h3 class="product-name">').slice(1)) {
        const nombre = /<span>([\s\S]*?)<\/span>/.exec(block)
        if (!nombre) continue
        const producto = limpiar(nombre[1]).replace(/\s*\(#\d+\)\s*$/, "")
        for (const row of block.split(/<tr>/).slice(1)) {
            const key = /lmfwc-myaccount-license-key">([\s\S]*?)<\/span>/.exec(row)
            if (!key) continue
            const licenciaId = /view-license-keys\/(\d+)\//.exec(row)?.[1]
            const pedidoId = /view-order\/(\d+)\//.exec(row)?.[1]
            const fecha = /<b>([\s\S]*?)<\/b>/.exec(row)
            out.push({
                licenciaId: licenciaId ? Number(licenciaId) : null,
                pedidoId: pedidoId ? Number(pedidoId) : null,
                producto,
                texto: limpiar(key[1]),
                vence: fecha ? fechaISO(fecha[1]) : null,
            })
        }
    }
    return out
}

export async function leerLicenciasDelPedido(s: Sesion, pedidoId: number): Promise<LicenciaProveedor[]> {
    const { status, html } = await pagina(s, "/mi-cuenta/view-license-keys/")
    if (status !== 200) throw new ProveedorError(`No pude leer "Mis licencias" del proveedor (HTTP ${status}).`, "sitio")
    return parseLicencias(html).filter((l) => l.pedidoId === pedidoId)
}

/** Estado del pedido en el sitio ("Completado", "Procesando"...), o null si no se pudo leer. */
export async function leerEstadoPedido(s: Sesion, pedidoId: number): Promise<string | null> {
    const { status, html } = await pagina(s, `/mi-cuenta/view-order/${pedidoId}/`)
    if (status !== 200) return null
    const m = /<mark class="order-status[^>]*>([\s\S]*?)<\/mark>/.exec(html)
    return m ? limpiar(m[1]) : null
}
