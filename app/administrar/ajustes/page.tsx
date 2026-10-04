import { redirect } from "next/navigation"
import { rutaServidor } from "@lib/supabase/server"
import { getRoleUser } from "@action/get-role-action"
import { getWhatsappAsesor } from "@lib/ajustes"
import WhatsappCard from "@/app/administrar/ajustes/whatsapp-card"

export default async function PageAdministrarAjustes() {
    const role = await getRoleUser()
    if (role !== "admin") redirect(await rutaServidor("/administrar"))

    const telefono = await getWhatsappAsesor()

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WhatsappCard telefonoActual={telefono} />
        </div>
    )
}
