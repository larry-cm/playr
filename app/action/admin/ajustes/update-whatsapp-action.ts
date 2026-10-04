"use server"

import { revalidatePath } from "next/cache"
import { getRoleUser } from "@action/get-role-action"
import { SIN_PERMISO } from "@lib/auth"
import { CLAVE_WHATSAPP_ASESOR } from "@lib/ajustes"
import { validatePhone } from "@lib/validation"
import { createSupabase } from "@lib/supabase/server"

export type UpdateWhatsappResult = { ok: true; valor: string } | { ok: false; error: string }

/**
 * Cambia el número de WhatsApp del asesor (Soporte y Tienda). Solo admin: además de esta revisión, la RLS de
 * business.ajuste (business.es_admin()) rechaza la escritura de cualquier otro rol.
 */
export async function updateWhatsappAsesorAction(codigo: string, numero: string): Promise<UpdateWhatsappResult> {
    if ((await getRoleUser()) !== "admin") return { ok: false, error: SIN_PERMISO }

    const digitos = String(numero ?? "").replace(/\D/g, "")
    if (!digitos) return { ok: false, error: "Ingresa el número de WhatsApp." }
    const invalido = validatePhone(String(codigo ?? ""), digitos)
    if (invalido) return { ok: false, error: invalido }

    // Se guarda en E.164 ("+573001234567"): indicativo + número, sin espacios. Quien lo lee se queda con los dígitos.
    const valor = `+${String(codigo).replace(/\D/g, "")}${digitos}`

    const supabase = await createSupabase()
    const { error } = await supabase
        .schema("business")
        .from("ajuste")
        .upsert({ clave: CLAVE_WHATSAPP_ASESOR, valor }, { onConflict: "clave" })

    if (error) {
        console.error("updateWhatsappAsesorAction:", error.message)
        return { ok: false, error: "No se pudo guardar el número. Inténtalo de nuevo." }
    }

    revalidatePath("/administrar")
    revalidatePath("/administrar/tienda")
    revalidatePath("/administrar/ajustes")
    return { ok: true, valor }
}
