"use server"

export async function deleteCustomerAction(formData: { id: string }) {
    const { id } = formData;
    if (!id) {
        return "Id no encontrado"
    }
    const { createSupabase } = await import("@lib/supabase/server");
    const supabase = await createSupabase()
    try {
        const { error } = await supabase
            .schema("main")
            .from("client")
            .update({ exist: false })
            .eq("id", id);
        if (!error) return null;
        return "Error al eliminar el cliente";
    } catch (error) {
        return "Error al intentar eliminar el cliente";
    }
}