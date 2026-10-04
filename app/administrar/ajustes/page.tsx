import { redirect } from "next/navigation"
import { rutaServidor } from "@lib/supabase/server"
import { getRoleUser } from "@action/get-role-action"
import { getLlavesBreb } from "@lib/ajustes"
import LlavesBrebCard from "@/app/administrar/ajustes/llaves-breb-card"

export default async function PageAdministrarAjustes() {
    const role = await getRoleUser()
    if (role !== "admin") redirect(await rutaServidor("/administrar"))

    const llaves = await getLlavesBreb()

    return (
        <LlavesBrebCard llaves={llaves} />
    )
}
