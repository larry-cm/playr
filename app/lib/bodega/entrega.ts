// Parseo PURO (sin red, sin Next) de las credenciales que entrega el proveedor ("Mis licencias"): cada licencia es un texto
// libre con una o varias credenciales, p. ej. "usuario@mail.com clave PERFIL 4 - PIN: 45698 (NO MODIFICAR ...)" o, en combos,
// "a@mail.com clave PERFIL 3 ... CRUNCHY b@mail.com clave2 PERFIL 1 ...". Lo usa Perfiles para mostrar la clave vigente.

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

/**
 * Contraseña vigente de una cuenta según "Mis licencias" del proveedor. La clave es de la cuenta (todos sus perfiles la
 * comparten), así que basta el correo; si el proveedor la cambió, manda la licencia que vence más tarde, y a igual
 * vencimiento la del mismo perfil. null = ninguna licencia trae ese correo.
 */
export function claveDeCuenta(licencias: { texto: string; vence: string | null }[], email: string, perfil: string | null): string | null {
    const correo = email.trim().toLowerCase()
    const mismoPerfil = perfil?.trim().toUpperCase().replace(/\s+/g, " ") ?? null
    const candidatos = licencias.flatMap((l) =>
        parseGrupos(l.texto)
            .filter((g) => g.email.toLowerCase() === correo)
            .map((g) => ({ password: g.password, vence: l.vence ?? "", perfil: g.perfil === mismoPerfil ? 1 : 0 })),
    )
    candidatos.sort((a, b) => b.vence.localeCompare(a.vence) || b.perfil - a.perfil)
    return candidatos[0]?.password ?? null
}

/** Mayusculas, sin tildes ni signos sueltos. */
const norm = (s: string) =>
    s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[()[\],.:;]/g, " ").replace(/\s+/g, " ").trim()

export const esCombo = (nombre: string) => /\bCOMBO\b/.test(norm(nombre))
