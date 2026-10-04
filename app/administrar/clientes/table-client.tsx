"use client"

import { useEffect, useState } from "react"
import Table from "@ui/table"
import type { CreateField, MutationResult } from "@ui/table"
import Card from "@ui/card"
import Button from "@ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"
import { validatePassword } from "@lib/validation"
import { getAllCustomersAction } from "@action/manager-and-admin/customers/get-all-customers-action"
import { editCustomerAction } from "@action/manager-and-admin/customers/edit-customer-action"
import { deleteCustomerAction } from "@action/manager-and-admin/customers/delete-customer-action"
import { createCustomerAction } from "@action/manager-and-admin/customers/create-customer-action"

type CustomerRow = Record<string, unknown>

// Referencia fija: la tabla adopta los datos nuevos cuando cambia la referencia de `data`.
const SIN_FILAS: CustomerRow[] = []

interface TableClientProps {
    /** Solo un admin puede crear managers y administradores; un manager solo crea clientes. */
    esAdmin: boolean
    /** Solo el esqueleto (loading.tsx): la tabla queda cargando y no se piden los clientes. */
    esqueleto?: boolean
}

export default function TableClient({ esAdmin, esqueleto = false }: Readonly<TableClientProps>) {
    // undefined = cargando · null = error · array = datos listos
    const [customers, setCustomers] = useState<CustomerRow[] | null | undefined>(undefined)

    useEffect(() => {
        if (esqueleto) return
        let active = true
        getAllCustomersAction().then((rows) => {
            if (active) setCustomers(rows)
        })
        return () => {
            active = false
        }
    }, [esqueleto])

    const reintentar = () => {
        setCustomers(undefined)
        getAllCustomersAction()
            .then(setCustomers)
            .catch(() => setCustomers(null))
    }

    // Se piden solo al crear. La server action los lee como formData["Contraseña"] y formData["Rol"].
    const createFields: CreateField[] = [
        {
            key: "Contraseña",
            label: "Contraseña",
            type: "password",
            validate: validatePassword,
            hint: "Mínimo 10 caracteres, con mayúscula, minúscula, número y símbolo.",
        },
        {
            key: "Rol",
            label: "Rol",
            type: "select",
            options: [
                { value: "user", label: "Cliente" },
                ...(esAdmin ? [{ value: "manager", label: "Manager" }, { value: "admin", label: "Administrador" }] : []),
            ],
        },
    ]

    const saveEditCustomer = async (formData: CustomerRow): Promise<MutationResult<CustomerRow>> => {
        const error = await editCustomerAction({
            id: formData["Id"],
            email: formData["Correo"],
            name: formData["Nombre"],
            phone: formData["Teléfono"],
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
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                    Error al cargar los clientes
                </h3>
                <p className="text-sm text-white/60 max-w-md">
                    Tuvimos un problema al obtener la información. Verifica la conexión e inténtalo de nuevo.
                </p>
                <Button variant="secondary" className="mt-4" onClick={reintentar} leftIcon={<RefreshCw className="h-4 w-4" />}>
                    Reintentar
                </Button>
            </Card>
        )
    }

    return (
        <article>
            {/* La fecha la genera la base de datos: se muestra, pero no se edita ni se pide al crear. */}
            <Table
                header={["Nombre", "Correo", "Teléfono", "Fecha de Creación"]}
                data={customers ?? SIN_FILAS}
                loading={customers === undefined}
                readOnlyColumns={["Fecha de Creación"]}
                entityName="cliente"
                createFields={createFields}
                onEditSave={saveEditCustomer}
                onDelete={deleteCustomer}
                onCreateSave={createCustomer} />
        </article>
    )
}
