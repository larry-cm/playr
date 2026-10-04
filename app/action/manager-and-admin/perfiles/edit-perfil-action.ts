"use server"

import { revalidatePath } from "next/cache"
import { getRoleUser } from "@action/get-role-action"
import { editPerfilSchema, firstErrorOfPerfil } from "@lib/perfil-schema"

/**
 * Edita SOLO este perfil: nombre, PIN, estado y, si cambian, su correo y su contraseña propios. Los demás perfiles de la
 * cuenta no se tocan. Un perfil sin datos propios hereda el correo de la cuenta y su contraseña se lee del proveedor; al
 * editarlos se guardan en el perfil (profile.email / profile.password_enc + password_editada_at) y desde ahí mandan
 * (ver app/lib/claves.ts). El estado decide si sigue a la venta (catalogo_disponible solo muestra disponible).
 */
export async function editPerfilAction(formData: {
    id: number
    estado: string
    nombre_perfil: string
    pin: string
    email: string
    password?: string
}): Promise<string | null> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return "No tienes permiso para editar perfiles."
    if (!formData.id) return "Id no encontrado"

    const data = editPerfilSchema.safeParse(formData)
    if (!data.success) return firstErrorOfPerfil(data.error)
    const { estado, nombre_perfil, pin, email, password } = data.data

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const db = supabase.schema("business")

    const { data: perfil, error: errPerfil } = await db
        .from("profile")
        .select("email,account:account_id!inner(email)")
        .eq("id", formData.id)
        .maybeSingle()
    if (errPerfil || !perfil) return "No se encontró el perfil."
    const emailCuenta = (perfil.account as unknown as { email: string }).email

    const cambios: { estado: string; nombre_perfil: string; pin: string | null; email?: string | null; password_enc?: string; password_editada_at?: string } =
        { estado, nombre_perfil, pin }
    // Volver a poner el correo de la cuenta = dejar de tener uno propio (vuelve a heredar).
    if (email !== (perfil.email ?? emailCuenta)) cambios.email = email === emailCuenta.toLowerCase() ? null : email
    if (password !== undefined) {
        const { data: cifrada, error: errCifrado } = await db.rpc("encrypt_account_password", { password })
        if (errCifrado || typeof cifrada !== "string") return "No se pudo cifrar la contraseña."
        cambios.password_enc = cifrada
        cambios.password_editada_at = new Date().toISOString()
    }

    const { error } = await db.from("profile").update(cambios).eq("id", formData.id)
    if (error) {
        console.error("editPerfilAction: profile update", error)
        if (error.code === "23505") return "Ya existe un perfil con ese nombre en esta cuenta."
        // P0001 = guarda de perfiles reservados por un pago por verificar (trigger profile_guarda_reservado).
        if (error.code === "P0001") return error.message
        // 42703/PGRST204 = faltan las columnas de datos propios (migración 20260927140001 sin aplicar)
        if (error.code === "42703" || error.code === "PGRST204") return "Falta aplicar en la base de datos la migración de datos propios por perfil."
        return "Error al actualizar el perfil."
    }

    revalidatePath("/administrar/perfiles")
    revalidatePath("/administrar/cuentas")
    revalidatePath("/administrar/tienda")
    return null
}
