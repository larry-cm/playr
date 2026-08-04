"use server"

export async function editCustomerAction(formData: any) {
    const { email, name: username, phone, id } = formData;
    if (!id) {
        return "Id no encontrado"
    }
    if (!email) {
        return "Email no encontrado"
    }
    if (!username) {
        return "Username no encontrado"
    }
    if (!phone) {
        return "Phone no encontrado"
    }
    const { createSupabase } = await import("@lib/supabase/server");
    const supabase = await createSupabase()
    try {
        const { error } = await supabase
            .schema("main")
            .from("client")
            .update({ username, phone, email })
            .eq("id", id);
        if (!error) return null;
        return "Error al editar el cliente";
    } catch (error) {
        return "Error al intentareditar el cliente";
    }
}