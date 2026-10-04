"use server"

import { revalidatePath } from "next/cache"
import { getRoleUser } from "@action/get-role-action"
import { SIN_PERMISO } from "@lib/auth"
import { CLAVE_LLAVE_BREB } from "@lib/ajustes"
import { validateLlaveBreb } from "@lib/pedido"
import { createSupabase } from "@lib/supabase/server"

export type UpdateLlaveBrebResult = { ok: true; valor: string } | { ok: false; error: string }

/**
 * Cambia la llave Bre-B a la que pagan los clientes en la Tienda. Solo admin: además de esta revisión, la RLS de
 * business.ajuste (business.es_admin()) rechaza la escritura de cualquier otro rol. Los pedidos ya creados guardan
 * la llave con la que se pagaron.
 */
export async function updateLlaveBrebAction(llave: string): Promise<UpdateLlaveBrebResult> {
    if ((await getRoleUser()) !== "admin") return { ok: false, error: SIN_PERMISO }

    const valor = String(llave ?? "").trim()
    const invalido = validateLlaveBreb(valor)
    if (invalido) return { ok: false, error: invalido }

    const supabase = await createSupabase()
    const { error } = await supabase
        .schema("business")
        .from("ajuste")
        .upsert({ clave: CLAVE_LLAVE_BREB, valor }, { onConflict: "clave" })

    if (error) {
        console.error("updateLlaveBrebAction:", error.message)
        return { ok: false, error: "No se pudo guardar la llave. Inténtalo de nuevo." }
    }

    revalidatePath("/administrar/tienda")
    revalidatePath("/administrar/ajustes")
    return { ok: true, valor }
}
