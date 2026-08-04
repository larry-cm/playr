"use server"

export async function getAllCustomersAction() {
    const { createSupabase } = await import("@lib/supabase/server");
    const { formatColombianDate } = await import("@lib/date");
    const { formatColombianNumberPhone } = await import("@lib/phone");

    const supabase = await createSupabase()
    try {
        const { data, error } = await supabase
            .schema("main")
            .from("client")
            .select("id,username,email,phone,created_at")
            .eq("exist", true);

        if (error) {
            return null;
        }
        return data
            .filter(customers =>
                formatColombianNumberPhone(customers.phone) !== "error" && formatColombianDate(customers.created_at) !== "error"
            )
            .map((customer) => ({
                Id: customer.id,
                Nombre: customer.username,
                Correo: customer.email,
                Teléfono: formatColombianNumberPhone(customer.phone),
                "Fecha de Creación": formatColombianDate(customer.created_at)
            }));
    } catch (error) {
        return null;
    }

}