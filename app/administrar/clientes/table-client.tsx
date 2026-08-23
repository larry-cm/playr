"use client"
import Table from "@ui/table"
import type { MutationResult } from "@ui/table"
import { editCustomerAction } from "@action/manager-and-admin/customers/edit-customer-action"
import { deleteCustomerAction } from "@action/manager-and-admin/customers/delete-customer-action"
import { createCustomerAction } from "@action/manager-and-admin/customers/create-customer-action"

type CustomerRow = Record<string, unknown>

export default function TableClient({ customers }: { customers: CustomerRow[] }) {
    const header = ["Nombre", "Correo", "Teléfono", "Fecha de Creación"]
    // La fecha la genera la base de datos: se muestra, pero no se edita ni se pide al crear.
    const readOnlyColumns = ["Fecha de Creación"]

    const saveEditCustomer = async (formData: CustomerRow): Promise<MutationResult<CustomerRow>> => {
        const error = await editCustomerAction({
            id: formData["Id"],
            email: formData["Correo"],
            name: formData["Nombre"],
            phone: formData["Teléfono"],
            createAt: formData["Fecha de Creación"]
        })
        if (error) return { ok: false, error }
        return { ok: true }
    }

    const deleteCustomer = async (id: string): Promise<MutationResult<CustomerRow>> => {
        const error = await deleteCustomerAction({ id })
        if (error) return { ok: false, error }
        return { ok: true }
    }

    const createCustomer = async (formData: CustomerRow): Promise<MutationResult<CustomerRow>> => {
        const result = await createCustomerAction(formData)
        if (typeof result === "string") return { ok: false, error: result }
        return { ok: true, row: result.customer }
    }

    return (
        <article>
            <Table
                header={header}
                data={customers}
                readOnlyColumns={readOnlyColumns}
                onEditSave={saveEditCustomer}
                onDelete={deleteCustomer}
                onCreateSave={createCustomer} />
        </article>
    )
}
