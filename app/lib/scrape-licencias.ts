// Scrapea business.platform + business.account no alcanzan para saber que compre "manualmente" en
// tuproveedor2.com antes de tener este panel: la unica fuente de verdad es la propia pagina del
// proveedor. Este modulo hace login (Ultimate Member sobre WordPress, mismo flujo que
// supabase/functions/stock-price-watch/lib.ts) y lee /mi-cuenta/view-license-keys/, que lista TODAS
// las licencias activas de la cuenta agrupadas por producto. Solo fetch + regex (sin DOM ni libs),
// duplicado a proposito en vez de importar del Edge Function: ese archivo vive bajo supabase/functions,
// fuera del build de Next, e importarlo cruzado le mete tipos de Deno al tsc de la app.

export const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

const ENT: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
    hellip: "…", iexcl: "¡", iquest: "¿", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
    Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
}
export const decode = (s: string) =>
    s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, d, h, n) =>
        d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : (ENT[n] ?? m))
export const limpiar = (s: string) => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()

// Mismo criterio de clasificacion que stock-price-watch/lib.ts: plataforma = la de nombre mas largo
// contenida como palabra en el titulo; COMBO => null (no se puede repartir en un unico platform_id).
function clasificar(nombre: string, plataformas: string[]): { platform: string | null; access: "completa" | "pantalla" | "otro" } {
    const n = ` ${nombre.toUpperCase().replace(/[()[\],.:;]/g, " ").replace(/\s+/g, " ")} `
    const access = / COMPLETA /.test(n) ? "completa" : / PANTALLA /.test(n) ? "pantalla" : "otro"
    if (/ COMBO /.test(n)) return { platform: null, access }
    const hit = plataformas.filter((p) => n.includes(` ${p.toUpperCase()} `)).sort((a, b) => b.length - a.length)[0]
    return { platform: hit ?? null, access }
}

const MESES_ES: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}

// "octubre 20, 2026 1:28 am GMT-0500" -> Date (fin del dia, margen conservador para el chequeo de vigencia)
export function parseFechaEs(texto: string): Date | null {
    const m = limpiar(texto).match(/^([a-záéíóúñ]+)\s+(\d{1,2}),\s+(\d{4})/i)
    if (!m) return null
    const mes = MESES_ES[m[1].toLowerCase()]
    if (mes === undefined) return null
    return new Date(Number(m[3]), mes, Number(m[2]), 23, 59, 59)
}

type Credencial = { email: string; password: string; perfil: string; pin: string | null }

// "usuario@mail.com clave PERFIL 4 - PIN: 45698 (nota...)". Los combos traen dos grupos concatenados
// en el mismo texto: este regex solo agarra el primero, por eso los combos se descartan ANTES de
// llamar a esto (ver scrapeLicenciasActivas), no ac.
function parseCredencial(texto: string): Credencial | null {
    const t = limpiar(texto)
    const m = t.match(/^(\S+@\S+?)\s+(\S+)\s+PERFIL\s+(\d+)\s*-\s*PIN:\s*(\d+)/i)
    if (!m) return null
    return { email: m[1], password: m[2], perfil: `PERFIL ${m[3]}`, pin: m[4] }
}

type LicenciaCruda = { productoNombre: string; validoHasta: Date | null; credencial: Credencial | null }

function parseLicenseKeysHtml(html: string): LicenciaCruda[] {
    const out: LicenciaCruda[] = []
    for (const block of html.split('<h3 class="product-name">').slice(1)) {
        const nameMatch = block.match(/<span>([\s\S]*?)<\/span>/)
        if (!nameMatch) continue
        const productoNombre = limpiar(nameMatch[1]).replace(/\s*\(#\d+\)\s*$/, "")
        for (const row of block.split(/<tr>/).slice(1)) {
            if (!row.includes("lmfwc-myaccount-license-key")) continue
            const keyMatch = row.match(/lmfwc-myaccount-license-key">([\s\S]*?)<\/span>/)
            if (!keyMatch) continue
            const fechaMatch = row.match(/<b>([\s\S]*?)<\/b>/)
            out.push({
                productoNombre,
                validoHasta: fechaMatch ? parseFechaEs(fechaMatch[1]) : null,
                credencial: parseCredencial(keyMatch[1]),
            })
        }
    }
    return out
}

export type LicenciaCfg = { base: string; storePath?: string; email: string; password: string }

export type LicenciaActiva = {
    platformNombre: string
    access: "completa" | "pantalla" | "otro"
    productoNombre: string
    validoHasta: Date
    email: string
    password: string
    perfil: string
    pin: string | null
}

export async function loginUltimateMember(base: string, email: string, password: string, jar: Map<string, string>) {
    const get = async (url: string, init: RequestInit = {}) => {
        const res = await fetch(url, {
            ...init,
            redirect: "manual",
            signal: AbortSignal.timeout(20_000),
            headers: { "user-agent": UA, "accept-language": "es-CO,es;q=0.9", cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), ...init.headers },
        })
        for (const s of res.headers.getSetCookie()) {
            const kv = s.split(";")[0]
            const i = kv.indexOf("=")
            jar.set(kv.slice(0, i).trim(), kv.slice(i + 1))
        }
        return res
    }

    const loginUrl = base + "/login/"
    const html = await (await get(loginUrl)).text()
    const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].map((m) => m[0]).find((f) => /type=["']password["']/i.test(f))
    if (!form) throw new Error("login: no encontre el formulario con password en /login/ (¿cambió el sitio?)")
    const attr = (tag: string, n: string) => tag.match(new RegExp(`\\b${n}=["']([^"']*)["']`, "i"))?.[1]
    const body = new URLSearchParams()
    for (const [tag] of form.matchAll(/<input\b[^>]*>/gi)) {
        const name = attr(tag, "name")
        const type = (attr(tag, "type") ?? "text").toLowerCase()
        if (!name || type === "checkbox" || type === "submit") continue
        body.set(name, type === "password" ? password : type === "text" || type === "email" ? email : decode(attr(tag, "value") ?? ""))
    }
    const action = new URL(attr(form.match(/<form\b[^>]*>/i)![0], "action") || "/login/", loginUrl).href
    const post = await get(action, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", origin: base, referer: loginUrl } })
    await post.arrayBuffer()
    if (![...jar.keys()].some((k) => k.startsWith("wordpress_logged_in_"))) throw new Error(`login al proveedor falló (HTTP ${post.status})`)

    return get
}

/** Todas las licencias activas (no vencidas, con credencial reconocible) de la cuenta del proveedor. Combos se descartan: no se pueden mapear a un unico platform_id. */
export async function scrapeLicenciasActivas(cfg: LicenciaCfg, plataformas: string[]): Promise<LicenciaActiva[]> {
    const base = cfg.base.replace(/\/+$/, "")
    const jar = new Map<string, string>()
    const get = await loginUltimateMember(base, cfg.email, cfg.password, jar)

    const res = await get(base + "/mi-cuenta/view-license-keys/")
    if (!res.ok) throw new Error(`no pude leer /mi-cuenta/view-license-keys/ (HTTP ${res.status})`)
    const html = await res.text()

    const ahora = new Date()
    const out: LicenciaActiva[] = []
    for (const l of parseLicenseKeysHtml(html)) {
        if (!l.validoHasta || l.validoHasta < ahora) continue
        if (!l.credencial) continue
        const c = clasificar(l.productoNombre, plataformas)
        if (!c.platform) continue
        out.push({ platformNombre: c.platform, access: c.access, productoNombre: l.productoNombre, validoHasta: l.validoHasta, ...l.credencial })
    }
    return out
}
