"use client"

import { useEffect, useState } from "react"
import Table from "@ui/table"
import type { MutationResult } from "@ui/table"
import Card from "@ui/card"
import { AlertCircle } from "lucide-react"
import { getAllCustomersAction } from "@action/manager-and-admin/customers/get-all-customers-action"
import { editCustomerAction } from "@action/manager-and-admin/customers/edit-customer-action"
import { deleteCustomerAction } from "@action/manager-and-admin/customers/delete-customer-action"
import { createCustomerAction } from "@action/manager-and-admin/customers/create-customer-action"

type CustomerRow = Record<string, unknown>

export default function TableClient() {
    // undefined = cargando · null = error · array = datos listos
    const [customers, setCustomers] = useState<CustomerRow[] | null | undefined>(undefined)

    useEffect(() => {
        let active = true
        getAllCustomersAction().then((rows) => {
            if (active) setCustomers(rows)
        })
        return () => {
            active = false
        }
    }, [])

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

    if (customers === null) {
        return (
            <Card className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                    Error al cargar los clientes
                </h3>
                <p className="text-sm text-white/60 max-w-md">
                    Tuvimos un problema al obtener la información. Por favor intenta de nuevo más tarde o verifica la conexión.
                </p>
            </Card>
        )
    }

    return (
        <article>
            {/* La fecha la genera la base de datos: se muestra, pero no se edita ni se pide al crear. */}
            <Table
                header={["Nombre", "Correo", "Teléfono", "Fecha de Creación"]}
                data={customers ?? []}
                loading={customers === undefined}
                readOnlyColumns={["Fecha de Creación"]}
                onEditSave={saveEditCustomer}
                onDelete={deleteCustomer}
                onCreateSave={createCustomer} />
        </article>
    )
}
