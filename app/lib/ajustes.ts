// Solo servidor: lee con la sesión del request (cookies). Los componentes cliente reciben el valor por props.
import { cache } from "react"
import { createSupabase } from "@lib/supabase/server"

export interface LlaveBreb {
    id: number
    /** Para que el cliente la reconozca: "Nequi", "Bancolombia"… */
    nombre: string
    llave: string
    /** Inactiva = el cliente no la ve. */
    activa: boolean
    /** La que el cliente ve ya seleccionada al pagar (a lo sumo una, siempre visible). */
    predeterminada: boolean
    /** QR que generó la app del banco para esta llave (bucket público 'llaves-qr'); null = sin QR. */
    qr_url: string | null
}

/**
 * Llaves Bre-B a las que pagan los clientes (business.llave_breb): la predeterminada primero y el resto en el orden en
 * que se agregaron. La RLS decide qué llega: el cliente ve solo las activas, el admin todas. [] = ninguna (la Tienda no
 * deja pagar). Nunca lanza.
 */
export const getLlavesBreb = cache(async (): Promise<LlaveBreb[]> => {
    try {
        const supabase = await createSupabase()
        const { data, error } = await supabase
            .schema("business")
            .from("llave_breb")
            .select("id,nombre,llave,activa,predeterminada,qr_path")
            .order("predeterminada", { ascending: false })
            .order("id")
        if (error) console.error("getLlavesBreb: no se pudo leer business.llave_breb:", error.message)
        return (data ?? []).map(({ qr_path, ...l }) => ({
            ...l,
            qr_url: qr_path ? supabase.storage.from("llaves-qr").getPublicUrl(qr_path).data.publicUrl : null,
        }))
    } catch (e) {
        console.error("getLlavesBreb: no se pudo leer business.llave_breb:", e)
        return []
    }
})
