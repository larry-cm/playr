"use server"

import { getRoleUser } from "@action/get-role-action"
import { SIN_PERMISO } from "@lib/auth"
import { createCustomerSchema, firstErrorOf, normalizePhone } from "@lib/customer-schema"
import { createSupabaseAdmin } from "@lib/supabase/admin"

type CustomerInput = Record<string, unknown> | FormData

export const createCustomerAction = async (formData: CustomerInput) => {
    // Solo staff crea usuarios, y solo un admin puede crear otro admin/manager.
    const quien = await getRoleUser()
    if (quien !== "admin" && quien !== "manager") return SIN_PERMISO

    const getVal = (...keys: string[]): string | undefined => {
        for (const key of keys) {
            const value = formData instanceof FormData ? formData.get(key) : formData?.[key]
            if (typeof value === "string" && value !== "") return value
        }
        return undefined
    }

    // La tabla manda el teléfono como un único texto; un formulario con PhoneInput
    // suelto mandaría indicativo y número por separado. Aceptamos ambas formas.
    const getPhone = () => {
        const single = getVal("Teléfono", "phone")
        if (single) return single

        const number = getVal("celular_numero")
        return number ? `${getVal("celular_codigo") || "+57"} ${number}` : ""
    }

    const data = createCustomerSchema.safeParse({
        email: getVal("Correo", "email") ?? "",
        password: getVal("Contraseña", "password") ?? "",
        username: getVal("Nombre", "username", "name") ?? "",
        rol: getVal("Rol", "rol") ?? "user",
        phone: getPhone(),
    })

    if (!data.success) return firstErrorOf(data.error)
    if (data.data.rol !== "user" && quien !== "admin") return "Solo un administrador puede crear usuarios staff."

    // El registro público está cerrado: el alta la hace el servidor con la clave secreta, sin tocar la
    // sesión (cookies) del staff que está creando al cliente.
    const admin = createSupabaseAdmin()
    if (!admin) return "Falta configurar SUPABASE_SECRET_KEY en el servidor."

    // Se guarda normalizado ("+57 3001234567"), no el texto tal cual se escribió.
    const phone = normalizePhone(data.data.phone)

    const { data: authData, error } = await admin.auth.admin.createUser({
        email: data.data.email,
        password: data.data.password,
        email_confirm: true,
        // Solo datos de perfil: el rol NUNCA va en user_metadata (el usuario puede editarlo).
        user_metadata: { username: data.data.username, ...(phone ? { phone } : {}) },
    })

    if (error || !authData.user) {
        if (error?.code === "email_exists") return "Ya existe un usuario con ese correo."
        return "No se pudo crear el usuario."
    }
    const userId = authData.user.id

    // Si falla algún paso siguiente se borra el usuario: no queda un login sin cliente o sin rol.
    const deshacer = async (mensaje: string) => {
        await admin.auth.admin.deleteUser(userId)
        return mensaje
    }

    const { data: created, error: clientError } = await admin
        .schema("security")
        .from("client")
        .insert({ id: userId, username: data.data.username, email: data.data.email, phone: phone || null })
        .select("id,username,email,phone,created_at")
        .single()
    if (clientError || !created) return deshacer("Error al guardar el cliente.")

    const { data: roleRow } = await admin.schema("security").from("role").select("id").eq("nombre", data.data.rol).single()
    if (!roleRow) return deshacer("Error al asignar el rol.")

    const { error: roleError } = await admin
        .schema("security")
        .from("user_role")
        .insert({ auth_user_id: userId, role_id: roleRow.id })
    if (roleError) return deshacer("Error al asignar el rol.")

    // Devolvemos la fila ya creada para que la tabla la pinte sin recargar el resto.
    const { formatPhoneNumber } = await import("@lib/phone")
    const { formatColombianDate } = await import("@lib/date")

    const fecha = created.created_at ? formatColombianDate(created.created_at) : "error"

    return {
        customer: {
            Id: created.id,
            Nombre: created.username,
            Correo: created.email,
            Teléfono: formatPhoneNumber(created.phone ?? ""),
            "Fecha de Creación": fecha === "error" ? "--" : fecha,
        },
    }
}
