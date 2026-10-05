"use server"

// Carpetas de la bandeja (compartidas por todo el staff): crear/editar, borrar, ordenar y elegir sus chats.
import { esStaff, SIN_PERMISO } from "@lib/auth"
import {
    carpetaIdSchema,
    carpetasIdsSchema,
    carpetaSchema,
    clienteIdSchema,
    clientesIdsSchema,
    firstError,
    ordenCarpetasSchema,
    type CarpetaInput,
} from "@lib/chat-bandeja"
import { rpcStaff, type Resultado } from "@action/manager-and-admin/mensajes/rpc-staff"

/** Crea (sin id; va al final) o edita una carpeta. Devuelve su id. */
export async function guardarCarpetaAction(input: CarpetaInput): Promise<Resultado<{ id: number }>> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const p = carpetaSchema.safeParse(input)
    if (!p.success) return { ok: false, error: firstError(p.error) }

    const res = await rpcStaff<number>("chat_carpeta_guardar", { p_id: p.data.id, p_nombre: p.data.nombre, p_icono: p.data.icono })
    return res.ok ? { ok: true, id: Number(res.data) } : res
}

/** Borra la carpeta (los chats siguen en la bandeja). */
export async function eliminarCarpetaAction(id: number): Promise<Resultado> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const p = carpetaIdSchema.safeParse(id)
    if (!p.success) return { ok: false, error: firstError(p.error) }

    const res = await rpcStaff("chat_carpeta_eliminar", { p_id: p.data })
    return res.ok ? { ok: true } : res
}

/** Nuevo orden: todas las carpetas, cada una una vez. */
export async function ordenarCarpetasAction(ids: number[]): Promise<Resultado> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const p = ordenCarpetasSchema.safeParse(ids)
    if (!p.success) return { ok: false, error: firstError(p.error) }

    const res = await rpcStaff("chat_carpetas_ordenar", { p_ids: p.data })
    return res.ok ? { ok: true } : res
}

/** Deja exactamente esos chats en la carpeta (≤100). */
export async function carpetaChatsAction(carpetaId: number, clienteIds: string[]): Promise<Resultado> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const c = carpetaIdSchema.safeParse(carpetaId)
    if (!c.success) return { ok: false, error: firstError(c.error) }
    const p = clientesIdsSchema.safeParse(clienteIds)
    if (!p.success) return { ok: false, error: firstError(p.error) }

    const res = await rpcStaff("chat_carpeta_chats", { p_carpeta_id: c.data, p_clientes: p.data })
    return res.ok ? { ok: true } : res
}

/** Deja el chat del cliente exactamente en esas carpetas ([] = ninguna). */
export async function carpetasDeClienteAction(clienteId: string, ids: number[]): Promise<Resultado> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const c = clienteIdSchema.safeParse(clienteId)
    if (!c.success) return { ok: false, error: firstError(c.error) }
    const p = carpetasIdsSchema.safeParse(ids)
    if (!p.success) return { ok: false, error: firstError(p.error) }

    const res = await rpcStaff("chat_carpetas_de_cliente", { p_cliente_id: c.data, p_carpetas: p.data })
    return res.ok ? { ok: true } : res
}
