// Solo servidor (no es una server action): llamada común de las acciones de la bandeja a las funciones de la base.
import { revalidatePath } from "next/cache"
import { SIN_PERMISO } from "@lib/auth"

export type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }

const GENERICO = "No se pudo guardar el cambio. Inténtalo de nuevo."

/** 22023 = error para el usuario (texto de la base, en español); 42501 = sin permiso; lo demás, genérico. */
export function errorDeRpc(error: { code?: string; message: string }, generico = GENERICO): string {
    if (error.code === "22023") return error.message
    if (error.code === "42501") return SIN_PERMISO
    return generico
}

/**
 * Llama a business.<fn> con la sesión de quien llama (la función vuelve a verificar que sea staff) y, si salió bien,
 * refresca la bandeja. Quien llama ya verificó esStaff() y validó los datos.
 */
export async function rpcStaff<R = unknown>(fn: string, args: Record<string, unknown>): Promise<Resultado<{ data: R }>> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data, error } = await supabase.schema("business").rpc(fn, args)
    if (error) {
        console.error(`${fn}:`, error.code, error.message)
        return { ok: false, error: errorDeRpc(error) }
    }
    revalidatePath("/administrar/mensajes")
    return { ok: true, data: data as R }
}
