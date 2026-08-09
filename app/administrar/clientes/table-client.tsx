"use client";
import Table from "@ui/table";
import { editCustomerAction } from "@/app/action/manager-and-admin/customers/edit-customer-action"
import { deleteCustomerAction } from "@/app/action/manager-and-admin/customers/delete-customer-action";
import { createCustomerAction } from "@/app/action/manager-and-admin/customers/create-customer-action";
export default function TableClient({ customers }: { customers: any[] }) {
    const header = ["Nombre", "Correo", "Teléfono", "Fecha de Creación"];

    const saveEditCustomer = async (formData: any) => {
        const error = await editCustomerAction({
            id: formData["Id"],
            email: formData["Correo"],
            name: formData["Nombre"],
            phone: formData["Teléfono"],
            createAt: formData["Fecha de Creación"]
        });
        if (error) console.error("Error al editar el cliente -> " + error);
    }

    const deleteCustomer = async (id: string) => {
        const error = await deleteCustomerAction({ id });
        if (error) console.error("Error al eliminar el cliente -> " + error);
    }

    const createCustomer = async (formData: any) => {
        const error = await createCustomerAction(formData);
        if (error) console.error("Error al crear el cliente -> " + error);
    }

    return (
        <article>
            <Table
                header={header}
                data={customers}
                onEditSave={saveEditCustomer}
                onDelete={deleteCustomer}
                onCreateSave={createCustomer} />
        </article>
    );
}