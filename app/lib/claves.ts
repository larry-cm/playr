import type { SupabaseClient } from "@supabase/supabase-js"
import { cfgProveedor, conectar, leerLicencias } from "@lib/bodega/proveedor"
import { claveDeCuenta } from "@lib/bodega/entrega"
import { notificar } from "@lib/notify"

export type ClavePerfil = { ok: true; password: string } | { ok: false; error: string }

type Licencias = Awaited<ReturnType<typeof leerLicencias>>

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
    const encKey = process.env.ACCOUNT_ENC_KEY

    const { data: cuenta } = await db.from("account").select("id,email,password_editada_at").eq("id", pedidos.cuentaId).maybeSingle()
    if (!cuenta) {
        const error: ClavePerfil = { ok: false, error: "No se encontró la cuenta." }
        return { cuenta: pedidos.conCuenta ? error : null, perfiles: Object.fromEntries(pedidos.perfilIds.map((id) => [id, error])) }
    }

    const { data: perfiles } = pedidos.perfilIds.length
        ? await db.from("profile").select("id,nombre_perfil,password_editada_at").in("id", pedidos.perfilIds).eq("account_id", cuenta.id)
        : { data: [] as { id: number; nombre_perfil: string; password_editada_at: string | null }[] }

    const descifrar = async (fn: "decrypt_profile_password" | "decrypt_account_password", id: number): Promise<ClavePerfil> => {
        if (!encKey) return { ok: false, error: "Falta ACCOUNT_ENC_KEY en el servidor: no se puede leer la contraseña guardada." }
        const args = fn === "decrypt_profile_password" ? { p_profile_id: id, p_enc_key: encKey } : { p_account_id: id, p_enc_key: encKey }
        const { data, error } = await db.rpc(fn, args)
        return !error && typeof data === "string" ? { ok: true, password: data } : { ok: false, error: "No se pudo leer la contraseña guardada." }
    }

    // El proveedor solo se lee si algún dato pedido es virgen, y una sola vez.
    let licencias: Promise<Licencias | ClavePerfil> | null = null
    const delProveedor = async (perfil: string | null): Promise<ClavePerfil> => {
        licencias ??= (async () => {
            const cfg = cfgProveedor()
            if (!cfg) return { ok: false, error: "Falta configuración del proveedor en el servidor." } as ClavePerfil
            try {
                return await leerLicencias(await conectar(cfg))
            } catch (e) {
                await notificar({ origen: "scraping", tipo: "error", titulo: "No se pudo leer las licencias del proveedor", mensaje: e })
                return { ok: false, error: "No se pudo consultar el proveedor." } as ClavePerfil
            }
        })()
        const lic = await licencias
        if (!Array.isArray(lic)) return lic
        const password = claveDeCuenta(lic, cuenta.email, perfil)
        return password ? { ok: true, password } : { ok: false, error: "El proveedor no tiene una licencia con este correo." }
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
