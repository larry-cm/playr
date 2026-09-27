// Solo servidor: lee con la sesión del request (cookies). Los componentes cliente reciben el valor por props.
import { cache } from "react"
import { createSupabase } from "@lib/supabase/server"
import { whatsappAdvisorNumber } from "@lib/const"

/** Clave del número del asesor en business.ajuste. */
export const CLAVE_WHATSAPP_ASESOR = "whatsapp_asesor"

/** Solo dígitos (wa.me no acepta signos). "" = no configurado. */
const soloDigitos = (valor: string | null | undefined) => (valor ?? "").replace(/\D/g, "")

/**
 * Número de WhatsApp del asesor (solo dígitos, "" si no hay). Lo configura el admin en Ajustes; si no hay fila, la tabla
 * aún no existe (migración sin aplicar) o la lectura falla, cae a NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER. Nunca lanza.
 */
export const getWhatsappAsesor = cache(async (): Promise<string> => {
    try {
        const supabase = await createSupabase()
        const { data, error } = await supabase
            .schema("business")
            .from("ajuste")
            .select("valor")
            .eq("clave", CLAVE_WHATSAPP_ASESOR)
            .maybeSingle<{ valor: string }>()

        if (error) console.error("getWhatsappAsesor: no se pudo leer business.ajuste:", error.message)
        const guardado = soloDigitos(data?.valor)
        if (guardado) return guardado
    } catch (e) {
        console.error("getWhatsappAsesor: no se pudo leer business.ajuste:", e)
    }
    return soloDigitos(whatsappAdvisorNumber)
})
