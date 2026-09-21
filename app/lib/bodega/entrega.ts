// Parseo PURO (sin red, sin Next) de lo que entrega el proveedor tras una compra: la "clave de licencia" de cada unidad es un
// texto libre con una o varias credenciales. Formatos reales vistos en tuproveedor2.com:
//   normal:  usuario@mail.com clave PERFIL 4 - PIN: 45698 (NO MODIFICAR ...)
//   combo:   usuario@mail.com clave PERFIL 3 PIN 3698 - (NO ...) CRUNCHY otro@mail.com clave2 PERFIL 1 - (NO ...)
//            NETFLIX a@mail.com clave PERFIL 4 - PIN: 4569 (NO ...) CRUNCHY b@mail.com clave PERFIL 1 (NO ...)
//   raro:    usuario@mail.com:clave PERFIL 1 PIN 1234 (...)   |   solo un correo, sin clave ni perfil
// Nada de esto tiene formato garantizado, asi que la regla es CONSERVADORA: lo que no se reconoce con certeza NO se
// registra (queda "pendiente" con un motivo legible, sin datos sensibles) en vez de adivinar una credencial equivocada.

import type { AccessType } from "@lib/bodega/tipos"

export type { AccessType }

export interface GrupoCredencial {
    /** Marca que antecede a la credencial en los combos ("CRUNCHY", "HBO"), o null si no trae. */
    etiqueta: string | null
    email: string
    password: string
    /** "PERFIL 4", o null si la entrega no trae perfil. */
    perfil: string | null
    pin: string | null
}

const EMAIL = /^([^\s:@()<>,;]+@[^\s:@()<>,;]+\.[^\s:@()<>,;]+?)(?::(\S+))?$/
const ETIQUETA = /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ+]{2,}$/

/** Un token "correo" (opcionalmente pegado a su clave con dos puntos: correo:clave). */
function tokenEmail(t: string | undefined): { email: string; password: string | null } | null {
    if (!t) return null
    const m = EMAIL.exec(t.replace(/[.,;]+$/, ""))
    return m ? { email: m[1], password: m[2] ?? null } : null
}

/**
 * Divide el texto de UNA licencia en credenciales. Cada una arranca en un correo (con su etiqueta si la trae justo antes).
 * La clave se toma siempre del token siguiente al correo, aunque parezca otro correo: una clave con forma de correo no
 * abre un grupo nuevo.
 */
export function parseGrupos(texto: string): GrupoCredencial[] {
    const tokens = texto.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
    const inicios: { desde: number; etiqueta: string | null; emailIdx: number; passEnEmail: string | null }[] = []

    for (let i = 0; i < tokens.length; i++) {
        let etiqueta: string | null = null
        let e = i
        if (ETIQUETA.test(tokens[i]) && tokenEmail(tokens[i + 1])) {
            etiqueta = tokens[i]
            e = i + 1
        }
        const te = tokenEmail(tokens[e])
        if (!te) continue
        inicios.push({ desde: i, etiqueta, emailIdx: e, passEnEmail: te.password })
        i = te.password ? e : e + 1 // salta el correo y, si no venia pegada, su clave
    }

    return inicios.flatMap((g, k) => {
        const fin = k + 1 < inicios.length ? inicios[k + 1].desde : tokens.length
        const email = tokenEmail(tokens[g.emailIdx])!.email
        const siguiente = tokens[g.emailIdx + 1]
        const password = g.passEnEmail ?? (siguiente && !/^(PERFIL|PIN)$/i.test(siguiente) ? siguiente : null)
        if (!password) return []
        const resto = tokens.slice(g.emailIdx + 1, fin).join(" ")
        const perfil = /\bPERFIL\s*:?\s*(\d{1,2})\b/i.exec(resto)
        const pin = /\bPIN\s*:?\s*(\d{3,8})\b/i.exec(resto)
        return [{ etiqueta: g.etiqueta, email, password, perfil: perfil ? `PERFIL ${Number(perfil[1])}` : null, pin: pin ? pin[1] : null }]
    })
}

// ---- combos -------------------------------------------------------------------------------------------------------

export interface Plataforma {
    id: number
    nombre: string
}

/** Mayusculas, sin tildes ni signos sueltos (el "+" se conserva: "UNIVERSAL+" y el separador de combos). */
const norm = (s: string) =>
    s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[()[\],.:;]/g, " ").replace(/\s+/g, " ").trim()

function distancia(a: string, b: string): number {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
    for (let j = 1; j <= b.length; j++) d[0][j] = j
    for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++)
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    return d[a.length][b.length]
}

const plataformaDeParte = (parte: string, plataformas: Plataforma[]): Plataforma | null => {
    // la plataforma mas larga cuyo nombre abre la parte, por palabras completas ("HBO PLATINO" -> HBO, "APPLE TV" -> APPLE TV)
    const exacta = plataformas
        .filter((p) => `${parte} `.startsWith(`${norm(p.nombre)} `))
        .sort((a, b) => b.nombre.length - a.nombre.length)[0]
    if (exacta) return exacta
    // el sitio escribe "CRUNCHYRROLL" (doble R): se tolera UN error de tipeo en la primera palabra, solo si hay un unico candidato
    const palabra = parte.split(" ")[0]
    if (palabra.length < 6) return null
    const cerca = plataformas.filter((p) => !p.nombre.includes(" ") && distancia(norm(p.nombre), palabra) <= 1)
    return cerca.length === 1 ? cerca[0] : null
}

export const esCombo = (nombre: string) => /\bCOMBO\b/.test(norm(nombre))

/** Plataformas de un combo en el orden del nombre ("z COMBO NETFLIX + HBO PLATINO" -> [NETFLIX, HBO]); null si alguna no se reconoce. */
export function plataformasDelCombo(nombre: string, plataformas: Plataforma[]): Plataforma[] | null {
    const partes = norm(nombre).replace(/^Z /, "").replace(/^COMBO /, "").split(" + ")
    if (partes.length < 2) return null
    const out: Plataforma[] = []
    for (const parte of partes) {
        const p = plataformaDeParte(parte, plataformas)
        if (!p) return null
        out.push(p)
    }
    return out
}

/** "CRUNCHY" es marca de "CRUNCHYROLL"; "HBO" de "HBO". */
export const etiquetaCoincide = (etiqueta: string, plataforma: string) => {
    const e = norm(etiqueta)
    const p = norm(plataforma)
    return e.length >= 3 && (p.startsWith(e) || e.startsWith(p))
}

// ---- asignacion ---------------------------------------------------------------------------------------------------

export interface ListingCompra {
    nombre: string
    platformId: number | null
    accessType: AccessType
}

export interface LicenciaEntrega {
    licenciaId: number | null
    texto: string
    /** Fecha de vencimiento "YYYY-MM-DD" (la que muestra el proveedor), o null. */
    vence: string | null
}

/** Lo que espera business.registrar_licencias. */
export interface GrupoRegistrable {
    platform_id: number
    access_type: AccessType
    email: string
    password: string
    perfil: string
    pin: string | null
    vence: string | null
    costo: number | null
}

export interface Pendiente {
    licenciaId: number | null
    /** Motivo legible, sin credenciales. */
    motivo: string
}

export interface Asignacion {
    registrables: GrupoRegistrable[]
    pendientes: Pendiente[]
}

const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Reparte la entrega de una compra en credenciales registrables. Reglas:
 *  - producto normal: cada licencia debe traer EXACTAMENTE una credencial con perfil; va a la plataforma y acceso del listing.
 *  - combo: cada licencia debe traer una credencial por plataforma, en el orden del nombre; si trae etiqueta debe coincidir
 *    con la plataforma de esa posicion. Cada credencial de un combo es un perfil ("pantalla") y el costo del combo se reparte
 *    en partes iguales. Si una licencia de combo no cuadra, se deja pendiente ENTERA (no se registra a medias).
 *  - todo lo demas queda pendiente con su motivo.
 */
export function asignarEntrega(
    listing: ListingCompra,
    precioUnitario: number,
    licencias: LicenciaEntrega[],
    plataformas: Plataforma[],
): Asignacion {
    const registrables: GrupoRegistrable[] = []
    const pendientes: Pendiente[] = []
    const pend = (l: LicenciaEntrega, motivo: string) => pendientes.push({ licenciaId: l.licenciaId, motivo })

    const combo = listing.platformId === null && esCombo(listing.nombre)
    const partes = combo ? plataformasDelCombo(listing.nombre, plataformas) : null

    for (const l of licencias) {
        const grupos = parseGrupos(l.texto)
        if (grupos.length === 0) {
            pend(l, "no se reconoce una credencial (correo y clave) en la entrega")
            continue
        }

        if (!combo) {
            if (listing.platformId === null) pend(l, "el producto no tiene plataforma asociada")
            else if (grupos.length !== 1) pend(l, `la entrega trae ${grupos.length} credenciales y se esperaba 1`)
            else if (!grupos[0].perfil) pend(l, "la credencial no indica el perfil")
            else {
                const g = grupos[0]
                registrables.push({
                    platform_id: listing.platformId, access_type: listing.accessType, email: g.email, password: g.password,
                    perfil: g.perfil!, pin: g.pin, vence: l.vence, costo: redondear(precioUnitario),
                })
            }
            continue
        }

        if (!partes) pend(l, "no se pudieron deducir las plataformas del combo por su nombre")
        else if (grupos.length !== partes.length) pend(l, `el combo tiene ${partes.length} plataformas y la entrega trae ${grupos.length} credencial(es)`)
        else if (grupos.some((g, k) => g.etiqueta && !etiquetaCoincide(g.etiqueta, partes[k].nombre)))
            pend(l, "las marcas de la entrega no coinciden con el orden de las plataformas del combo")
        else if (grupos.some((g) => !g.perfil)) pend(l, "una credencial del combo no indica el perfil")
        else
            grupos.forEach((g, k) =>
                registrables.push({
                    platform_id: partes[k].id, access_type: "pantalla", email: g.email, password: g.password,
                    perfil: g.perfil!, pin: g.pin, vence: l.vence, costo: redondear(precioUnitario / partes.length),
                }),
            )
    }
    return { registrables, pendientes }
}
