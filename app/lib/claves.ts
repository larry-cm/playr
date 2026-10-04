import { after } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cfgProveedor, conectar, leerLicencias } from "@lib/bodega/proveedor"
import { claveDeCuenta } from "@lib/bodega/entrega"
import { notificar } from "@lib/notify"

export type ClavePerfil = { ok: true; password: string } | { ok: false; error: string }

/** Lo único que hace falta de cada licencia para encontrar una clave (claveDeCuenta); es lo que se guarda en caché. */
type Licencias = { texto: string; vence: string | null }[]

/** Leer "Mis licencias" en vivo tarda varios segundos (login + scraping): se guarda cifrada en business.licencias_cache. */
const CACHE_FRESCA_MS = 10 * 60_000
const CACHE_MAX_MS = 24 * 60 * 60_000

async function leerProveedor(db: ReturnType<SupabaseClient["schema"]>): Promise<Licencias | ClavePerfil> {
    const cfg = cfgProveedor()
    if (!cfg) return { ok: false, error: "Falta configuración del proveedor en el servidor." }
    try {
        const licencias: Licencias = (await leerLicencias(await conectar(cfg))).map(({ texto, vence }) => ({ texto, vence }))
        const { error } = await db.rpc("guardar_licencias_cache", { p_datos: JSON.stringify(licencias) })
        if (error) console.error("resolverClaves: no se pudo guardar la caché de licencias:", error.message)
        return licencias
    } catch (e) {
        await notificar({ origen: "scraping", tipo: "error", titulo: "No se pudo leer las licencias del proveedor", mensaje: e })
        return { ok: false, error: "No se pudo consultar el proveedor." }
    }
}

/** Corre después de responder si se puede (server action / route handler); si no, en segundo plano igual. */
function despues(tarea: () => Promise<unknown>) {
    try {
        after(tarea)
    } catch {
        void tarea().catch(() => {})
    }
}

/**
 * De dónde sale la contraseña que se muestra (solo servidor; quien llama ya verificó el rol):
 *   1. perfil editado (profile.password_editada_at)  → la guardada del perfil
 *   2. cuenta editada (account.password_editada_at)  → la guardada de la cuenta
 *   3. dato virgen                                   → EN VIVO de "Mis licencias" del proveedor, por el correo de la
 *      compra (account.email), así se ve la vigente aunque el proveedor la haya cambiado después.
 * El proveedor se consulta una sola vez por llamada, aunque se pidan varios perfiles.
 */
export async function resolverClaves(
    supabase: SupabaseClient,
    pedidos: { cuentaId: number; perfilIds: number[]; conCuenta: boolean },
): Promise<{ cuenta: ClavePerfil | null; perfiles: Record<number, ClavePerfil> }> {
    const db = supabase.schema("business")

    const { data: cuenta } = await db.from("account").select("id,email,password_editada_at").eq("id", pedidos.cuentaId).maybeSingle()
    if (!cuenta) {
        const error: ClavePerfil = { ok: false, error: "No se encontró la cuenta." }
        return { cuenta: pedidos.conCuenta ? error : null, perfiles: Object.fromEntries(pedidos.perfilIds.map((id) => [id, error])) }
    }

    const { data: perfiles } = pedidos.perfilIds.length
        ? await db.from("profile").select("id,nombre_perfil,password_editada_at").in("id", pedidos.perfilIds).eq("account_id", cuenta.id)
        : { data: [] as { id: number; nombre_perfil: string; password_editada_at: string | null }[] }

    const descifrar = async (fn: "decrypt_profile_password" | "decrypt_account_password", id: number): Promise<ClavePerfil> => {
        const args = fn === "decrypt_profile_password" ? { p_profile_id: id } : { p_account_id: id }
        const { data, error } = await db.rpc(fn, args)
        return !error && typeof data === "string" ? { ok: true, password: data } : { ok: false, error: "No se pudo leer la contraseña guardada." }
    }

    // El proveedor solo se lee si algún dato pedido es virgen, y una sola vez. Primero la caché: fresca (<10 min) se usa
    // tal cual; vieja (<24 h) se usa y se refresca después de responder. Si en la caché no está el correo (compra más
    // nueva que la caché) se lee en vivo.
    let enVivo: Promise<Licencias | ClavePerfil> | null = null
    const vivo = () => (enVivo ??= leerProveedor(db))
    let cacheada: Promise<Licencias | null> | null = null
    const deCache = () => (cacheada ??= (async () => {
        const { data, error } = await db.rpc("leer_licencias_cache")
        const fila = Array.isArray(data) ? (data[0] as { datos: string; leido_at: string } | undefined) : undefined
        if (error || !fila) return null
        const edad = Date.now() - new Date(fila.leido_at).getTime()
        if (edad > CACHE_MAX_MS) return null
        if (edad > CACHE_FRESCA_MS) despues(vivo)
        try {
            return JSON.parse(fila.datos) as Licencias
        } catch {
            return null
        }
    })())

    const delProveedor = async (perfil: string | null): Promise<ClavePerfil> => {
        const enCache = await deCache()
        const password = enCache && claveDeCuenta(enCache, cuenta.email, perfil)
        if (password) return { ok: true, password }
        const lic = await vivo()
        if (!Array.isArray(lic)) return lic
        const actual = claveDeCuenta(lic, cuenta.email, perfil)
        return actual ? { ok: true, password: actual } : { ok: false, error: "El proveedor no tiene una licencia con este correo." }
    }

    const deCuenta = (perfil: string | null) =>
        cuenta.password_editada_at ? descifrar("decrypt_account_password", cuenta.id) : delProveedor(perfil)

    const resultado: Record<number, ClavePerfil> = {}
    await Promise.all(
        pedidos.perfilIds.map(async (id) => {
            const p = (perfiles ?? []).find((x) => x.id === id)
            if (!p) resultado[id] = { ok: false, error: "No se encontró el perfil." }
            else resultado[id] = p.password_editada_at ? await descifrar("decrypt_profile_password", p.id) : await deCuenta(p.nombre_perfil)
        }),
    )

    return { cuenta: pedidos.conCuenta ? await deCuenta(null) : null, perfiles: resultado }
}

/**
 * Deja la caché de licencias al día (p. ej. al aprobar un pedido), así el cliente ve sus accesos al instante. Nunca
 * lanza; una falla del proveedor ya queda en la campana.
 */
export async function precalentarLicencias(supabase: SupabaseClient): Promise<void> {
    await leerProveedor(supabase.schema("business")).catch(() => {})
}
