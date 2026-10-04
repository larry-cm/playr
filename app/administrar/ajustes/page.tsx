import { redirect } from "next/navigation"
import { rutaServidor } from "@lib/supabase/server"
import { getRoleUser } from "@action/get-role-action"
import { getLlaveBreb, getWhatsappAsesor } from "@lib/ajustes"
import WhatsappCard from "@/app/administrar/ajustes/whatsapp-card"
import LlaveBrebCard from "@/app/administrar/ajustes/llave-breb-card"

export default async function PageAdministrarAjustes() {
    const role = await getRoleUser()
    if (role !== "admin") redirect(await rutaServidor("/administrar"))

    const [telefono, llave] = await Promise.all([getWhatsappAsesor(), getLlaveBreb()])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WhatsappCard telefonoActual={telefono} />
            <LlaveBrebCard llaveActual={llave} />
        </div>
    )
}
