import { formatColombianDate } from "@lib/date";
import { formatColombianNumberPhone } from "@lib/phone";

export async function getCustomersAction() {
    const supabase = await import("@lib/supabase/server").then((mod) => mod.createSupabase());

    const { data, error } = await supabase
        .schema("main")
        .from("client")
        .select("id,username,email,phone,created_at")
        .eq("exist", true);

    if (error) {
        console.error("Error al obtener clientes: getCustomers");
        return [];
    }
    return data
        .filter(customers =>
            formatColombianNumberPhone(customers.phone) !== "error" && formatColombianDate(customers.created_at) !== "error"
        )
        .map((customer) => ({
            Nombre: customer.username,
            Correo: customer.email,
            Teléfono: formatColombianNumberPhone(customer.phone),
            "Fecha de Creación": formatColombianDate(customer.created_at)
        }));
}