"use server"

import { revalidatePath } from "next/cache"
import { getRoleUser } from "@action/get-role-action"
import { SIN_PERMISO } from "@lib/auth"
import { validateLlaveBreb, validateNombreLlave } from "@lib/pedido"
import { createSupabase } from "@lib/supabase/server"

// Llaves Bre-B a las que pagan los clientes (business.llave_breb). Solo admin: además de esta revisión, la RLS
// (business.es_admin()) rechaza la escritura de cualquier otro rol. Los pedidos ya creados guardan la llave y el nombre
// con los que se pagaron, así que editar o borrar una llave no los cambia.

export type LlaveResult = { ok: true } | { ok: false; error: string }

const ERROR_GUARDAR = "No se pudo guardar la llave. Inténtalo de nuevo."

const refrescar = () => {
    revalidatePath("/administrar/tienda")
    revalidatePath("/administrar/ajustes")
}

function datosValidos(nombre: unknown, llave: unknown): { nombre: string; llave: string } | string {
    const n = String(nombre ?? "").trim()
    const l = String(llave ?? "").trim()
    return validateNombreLlave(n) ?? validateLlaveBreb(l) ?? { nombre: n, llave: l }
}

const mensajeError = (error: { code?: string; message: string }, accion: string) => {
    console.error(`${accion}:`, error.message)
    return error.code === "23505" ? "Esa llave ya está en la lista." : ERROR_GUARDAR
}

export async function crearLlaveBrebAction(nombre: string, llave: string): Promise<LlaveResult> {
    if ((await getRoleUser()) !== "admin") return { ok: false, error: SIN_PERMISO }
    const datos = datosValidos(nombre, llave)
    if (typeof datos === "string") return { ok: false, error: datos }

    const supabase = await createSupabase()
    const llaves = supabase.schema("business").from("llave_breb")
    // Si todavía no hay predeterminada (p. ej. es la primera llave), esta lo es.
    const { count } = await llaves.select("id", { count: "exact", head: true }).eq("predeterminada", true)
    const { error } = await llaves.insert({ ...datos, predeterminada: count === 0 })
    if (error) return { ok: false, error: mensajeError(error, "crearLlaveBrebAction") }
    refrescar()
    return { ok: true }
}

export async function editarLlaveBrebAction(id: number, nombre: string, llave: string, activa: boolean): Promise<LlaveResult> {
    if ((await getRoleUser()) !== "admin") return { ok: false, error: SIN_PERMISO }
    if (!Number.isInteger(id) || typeof activa !== "boolean") return { ok: false, error: ERROR_GUARDAR }
    const datos = datosValidos(nombre, llave)
    if (typeof datos === "string") return { ok: false, error: datos }

    const supabase = await createSupabase()
    const { data, error } = await supabase.schema("business").from("llave_breb").update({ ...datos, activa, ...(activa ? {} : { predeterminada: false }) }).eq("id", id).select("id")
    if (error) return { ok: false, error: mensajeError(error, "editarLlaveBrebAction") }
    if (!data.length) return { ok: false, error: "La llave ya no existe." }
    refrescar()
    return { ok: true }
}

/** La llave que el cliente ve ya seleccionada al pagar. */
export async function marcarPredeterminadaAction(id: number): Promise<LlaveResult> {
    if ((await getRoleUser()) !== "admin") return { ok: false, error: SIN_PERMISO }
    if (!Number.isInteger(id)) return { ok: false, error: ERROR_GUARDAR }

    const supabase = await createSupabase()
    const { error } = await supabase.schema("business").rpc("marcar_llave_predeterminada", { p_id: id })
    if (error) {
        console.error("marcarPredeterminadaAction:", error.message)
        return { ok: false, error: error.code === "22023" ? error.message : ERROR_GUARDAR }
    }
    refrescar()
    return { ok: true }
}

/**
 * Guarda el QR (ya subido por el navegador a 'llaves-qr/<id>/...') o lo quita con null. El archivo anterior se borra
 * del bucket.
 */
export async function guardarQrLlaveAction(id: number, qrPath: string | null): Promise<LlaveResult> {
    if ((await getRoleUser()) !== "admin") return { ok: false, error: SIN_PERMISO }
    if (!Number.isInteger(id)) return { ok: false, error: ERROR_GUARDAR }
    if (qrPath !== null && (typeof qrPath !== "string" || !qrPath.startsWith(`${id}/`) || qrPath.includes(".."))) {
        return { ok: false, error: "El QR no es válido. Vuelve a subirlo." }
    }

    const supabase = await createSupabase()
    const llaves = supabase.schema("business").from("llave_breb")
    const { data: antes } = await llaves.select("qr_path").eq("id", id).maybeSingle()
    if (!antes) return { ok: false, error: "La llave ya no existe." }
    const { error } = await llaves.update({ qr_path: qrPath }).eq("id", id)
    if (error) return { ok: false, error: mensajeError(error, "guardarQrLlaveAction") }
    await quitarQr(supabase, antes.qr_path !== qrPath ? antes.qr_path : null)
    refrescar()
    return { ok: true }
}

/** Borra un QR del bucket; si falla solo queda un archivo huérfano (se avisa en el log). */
async function quitarQr(supabase: Awaited<ReturnType<typeof createSupabase>>, path: string | null) {
    if (!path) return
    const { error } = await supabase.storage.from("llaves-qr").remove([path])
    if (error) console.error("quitarQr:", error.message)
}

export async function borrarLlaveBrebAction(id: number): Promise<LlaveResult> {
    if ((await getRoleUser()) !== "admin") return { ok: false, error: SIN_PERMISO }
    if (!Number.isInteger(id)) return { ok: false, error: ERROR_GUARDAR }

    const supabase = await createSupabase()
    const { data, error } = await supabase.schema("business").from("llave_breb").delete().eq("id", id).select("qr_path")
    if (error) return { ok: false, error: mensajeError(error, "borrarLlaveBrebAction") }
    await quitarQr(supabase, data[0]?.qr_path ?? null)
    refrescar()
    return { ok: true }
}
