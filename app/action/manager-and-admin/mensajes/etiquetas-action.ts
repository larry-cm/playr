"use server"

// Etiquetas de la bandeja (compartidas por todo el staff): crear/editar, borrar y asignar a un chat.
import { esStaff, SIN_PERMISO } from "@lib/auth"
import { clienteIdSchema, etiquetaIdSchema, etiquetasIdsSchema, etiquetaSchema, firstError, type EtiquetaInput } from "@lib/chat-bandeja"
import { rpcStaff, type Resultado } from "@action/manager-and-admin/mensajes/rpc-staff"

/** Crea (sin id) o edita una etiqueta. Devuelve su id. */
export async function guardarEtiquetaAction(input: EtiquetaInput): Promise<Resultado<{ id: number }>> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const p = etiquetaSchema.safeParse(input)
    if (!p.success) return { ok: false, error: firstError(p.error) }

    const res = await rpcStaff<number>("chat_etiqueta_guardar", { p_id: p.data.id, p_nombre: p.data.nombre, p_color: p.data.color })
    return res.ok ? { ok: true, id: Number(res.data) } : res
}

/** Borra la etiqueta (sale de todos los chats). */
export async function eliminarEtiquetaAction(id: number): Promise<Resultado> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const p = etiquetaIdSchema.safeParse(id)
    if (!p.success) return { ok: false, error: firstError(p.error) }

    const res = await rpcStaff("chat_etiqueta_eliminar", { p_id: p.data })
    return res.ok ? { ok: true } : res
}

/** Deja exactamente esas etiquetas en el chat del cliente ([] = ninguna). */
export async function asignarEtiquetasAction(clienteId: string, ids: number[]): Promise<Resultado> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const c = clienteIdSchema.safeParse(clienteId)
    if (!c.success) return { ok: false, error: firstError(c.error) }
    const p = etiquetasIdsSchema.safeParse(ids)
    if (!p.success) return { ok: false, error: firstError(p.error) }

    const res = await rpcStaff("chat_etiquetas_asignar", { p_cliente_id: c.data, p_etiquetas: p.data })
    return res.ok ? { ok: true } : res
}
