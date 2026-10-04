import { cache } from "react"
import { getUsuario } from "@lib/supabase/server"

// cache(): el layout y la página lo piden en el mismo request; una sola consulta a auth + DB.
export const getRoleUser = cache(async (): Promise<"user" | "admin" | "manager" | "error"> => {
    const { user, supabase } = await getUsuario()
    if (!user) return "error"

    // El rol vive en security.user_role (no en user_metadata, que el usuario puede editar). La RLS solo
    // deja leer la fila propia y nadie la escribe desde el cliente: se asigna en el servidor.
    const { data, error: roleError } = await supabase
        .schema("security")
        .from("user_role")
        .select("role:role_id(nombre)")
        .eq("auth_user_id", user.id)
        .maybeSingle<{ role: { nombre: string } | null }>()

    if (roleError) {
        console.error("getRoleUser: fallo consultando security.user_role:", roleError)
    }

    const nombre = data?.role?.nombre
    // Antes caía a "admin" si faltaba el dato; default seguro ahora es "user" (mínimo privilegio).
    return nombre === "admin" || nombre === "manager" || nombre === "user" ? nombre : "user"
})
