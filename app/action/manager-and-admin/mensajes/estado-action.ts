"use server"

// Estado de cada chat (compartido por todo el staff): fijar, archivar, eliminar (solo para el staff), no leído a mano y
// notas internas. Más el total sin leer para la insignia del menú.
import { esStaff, SIN_PERMISO } from "@lib/auth"
import { booleanoSchema, clienteIdSchema, firstError, notasSchema } from "@lib/chat-bandeja"
import { rpcStaff, type Resultado } from "@action/manager-and-admin/mensajes/rpc-staff"

/** Valida el cliente (y el sí/no, si va) y llama a la función. Quien llama ya verificó esStaff(). */
async function cambiar(fn: string, clienteId: string, extra: Record<string, unknown> = {}, booleano?: { campo: string; valor: boolean }): Promise<Resultado> {
    const c = clienteIdSchema.safeParse(clienteId)
    if (!c.success) return { ok: false, error: firstError(c.error) }
    if (booleano) {
        const b = booleanoSchema.safeParse(booleano.valor)
        if (!b.success) return { ok: false, error: firstError(b.error) }
        extra = { ...extra, [booleano.campo]: b.data }
    }
    const res = await rpcStaff(fn, { p_cliente_id: c.data, ...extra })
    return res.ok ? { ok: true } : res
}

/** Fija (≤5; no si está archivado) o desfija el chat. */
export async function fijarChatAction(clienteId: string, fijar: boolean): Promise<Resultado> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    return cambiar("chat_fijar", clienteId, {}, { campo: "p_fijar", valor: fijar })
}

/** Archiva (y desfija) o desarchiva. Un mensaje nuevo del cliente lo desarchiva solo. */
export async function archivarChatAction(clienteId: string, archivar: boolean): Promise<Resultado> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    return cambiar("chat_archivar", clienteId, {}, { campo: "p_archivar", valor: archivar })
}

/** "Eliminar chat" solo para el staff: lo oculta hasta hoy; el cliente conserva su historial. */
export async function eliminarChatAction(clienteId: string): Promise<Resultado> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    return cambiar("chat_eliminar", clienteId)
}

/** Marca (o quita) "no leído" a mano. Abrir el chat la quita. */
export async function marcarNoLeidoAction(clienteId: string, noLeido: boolean): Promise<Resultado> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    return cambiar("chat_marcar_no_leido", clienteId, {}, { campo: "p_no_leido", valor: noLeido })
}

/** Notas internas del chat (≤1000; vacías = sin notas). Devuelve las notas como quedaron. */
export async function guardarNotasAction(clienteId: string, notas: string | null): Promise<Resultado<{ notas: string | null }>> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const n = notasSchema.safeParse(notas)
    if (!n.success) return { ok: false, error: firstError(n.error) }
    const res = await cambiar("chat_notas_guardar", clienteId, { p_notas: n.data })
    return res.ok ? { ok: true, notas: n.data } : res
}

/** Mensajes sin leer de todos los chats (insignia del menú). 0 si falla o no es staff; nunca lanza. */
export async function getSinLeerStaffAction(): Promise<number> {
    try {
        if (!(await esStaff())) return 0
        const { createSupabase } = await import("@lib/supabase/server")
        const supabase = await createSupabase()
        const { data, error } = await supabase.schema("business").rpc("chat_sin_leer_staff")
        if (error) {
            console.error("getSinLeerStaffAction:", error.message)
            return 0
        }
        const n = Number(data)
        return Number.isFinite(n) && n > 0 ? n : 0
    } catch (e) {
        console.error("getSinLeerStaffAction:", e)
        return 0
    }
}
