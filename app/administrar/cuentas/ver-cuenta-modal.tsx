"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { useRuta } from "@/app/administrar/sesion-tab"
import { ArrowUpRight, ChevronDown } from "lucide-react"
import Modal from "@ui/modal"
import Button from "@ui/button"
import CopyInput from "@ui/copy-input"
import type { CuentaRow } from "@action/manager-and-admin/cuentas/get-all-cuentas-action"
import { getClavesCuentaAction, getPerfilesCuentaAction, type PerfilDeCuenta } from "@action/manager-and-admin/cuentas/get-perfiles-cuenta-action"
import type { ClavePerfil } from "@lib/claves"
import { estadoColor, estadoLabel } from "@/app/administrar/perfiles/filtros-perfiles"
import { accessTypeLabel } from "@lib/access-type"
import { formatCOP } from "@lib/currency"
import { formatDateOnly } from "@lib/date"
import { capitalizar } from "@lib/text"

/** Campo de solo lectura con copiar. `secret`: la contraseña se ve oculta hasta pulsar "Mostrar". */
function Campo({ label, value, placeholder = "--", error, secret = false }: Readonly<{ label: string; value: string; placeholder?: string; error?: string; secret?: boolean }>) {
    const id = useId()
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs text-secondary font-medium">{label}</label>
            <CopyInput id={id} className="bg-white/3" value={value} placeholder={placeholder} readOnly secret={secret && value !== ""} copyLabel={`Copiar ${label.toLowerCase()}`} successLabel="Copiado" error={error} />
        </div>
    )
}

const campoClave = (clave: ClavePerfil | "cargando" | undefined) => ({
    value: clave && clave !== "cargando" && clave.ok ? clave.password : "",
    placeholder: !clave || clave === "cargando" ? "Consultando..." : "--",
    error: clave && clave !== "cargando" && !clave.ok ? clave.error : undefined,
})

/** Un perfil plegado muestra nombre, PIN y estado; al abrirlo, sus datos para copiar. */
function PerfilItem({ perfil, clave, abierto, onToggle }: Readonly<{ perfil: PerfilDeCuenta; clave: ClavePerfil | "cargando" | undefined; abierto: boolean; onToggle: () => void }>) {
    return (
        <div className="rounded-xl border border-white/8 bg-white/2">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={abierto}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-white/3"
            >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: estadoColor[perfil.estado] }} />
                <span className="flex-1 truncate text-sm font-medium text-white">
                    {capitalizar(perfil.nombre_perfil)}
                    {perfil.editado && (
                        <span className="ml-2 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent" title="Tiene correo o contraseña propios">
                            Editado
                        </span>
                    )}
                </span>
                <span className="text-xs text-secondary">PIN {perfil.pin ?? "--"}</span>
                <span className="w-20 text-right text-xs font-medium" style={{ color: estadoColor[perfil.estado] }}>
                    {estadoLabel[perfil.estado]}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-secondary transition-transform ${abierto ? "rotate-180" : ""}`} />
            </button>
            {abierto && (
                <div className="grid grid-cols-1 gap-3 border-t border-white/8 px-4 py-3 sm:grid-cols-2">
                    <Campo label="Correo" value={perfil.email} />
                    <Campo label="Contraseña" secret {...campoClave(clave)} />
                    <Campo label="Perfil" value={capitalizar(perfil.nombre_perfil)} />
                    <Campo label="PIN" value={perfil.pin ?? ""} />
                </div>
            )}
        </div>
    )
}

interface VerCuentaModalProps {
    cuenta: CuentaRow | null
    onClose: () => void
}

/**
 * "Ver cuenta": datos de la cuenta y, debajo, sus perfiles en cascada (acordeón). Los perfiles y la contraseña se piden al
 * abrir (el padre lo monta con key por cuenta, así cada apertura arranca limpia): la contraseña se lee en vivo del proveedor (tarda unos segundos) y es la misma para todos los perfiles de la cuenta.
 */
export default function VerCuentaModal({ cuenta, onClose }: Readonly<VerCuentaModalProps>) {
    const ruta = useRuta()
    const [perfiles, setPerfiles] = useState<PerfilDeCuenta[] | null | "cargando">("cargando")
    const [clave, setClave] = useState<ClavePerfil | "cargando">("cargando")
    const [clavesPerfil, setClavesPerfil] = useState<Record<number, ClavePerfil> | "cargando">("cargando")
    const [abiertos, setAbiertos] = useState<Set<number>>(new Set())

    const cuentaId = cuenta?.id ?? null

    useEffect(() => {
        if (cuentaId === null) return
        let vigente = true
        void getPerfilesCuentaAction(cuentaId).then(async (lista) => {
            if (!vigente) return
            setPerfiles(lista)
            // Una sola lectura del proveedor para la cuenta y todos sus perfiles.
            const res = await getClavesCuentaAction(cuentaId, (lista ?? []).map((p) => p.id))
            if (!vigente) return
            setClave(res.cuenta)
            setClavesPerfil(res.perfiles)
        })
        return () => {
            vigente = false
        }
    }, [cuentaId])

    const toggle = (id: number) =>
        setAbiertos((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

    const lista = Array.isArray(perfiles) ? perfiles : []
    const todosAbiertos = lista.length > 0 && lista.every((p) => abiertos.has(p.id))

    return (
        <Modal isOpen={cuenta !== null} title="Ver cuenta" onClose={onClose}>
            {cuenta && (
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Campo label="Plataforma" value={`${capitalizar(cuenta.platform_nombre)} · ${accessTypeLabel[cuenta.access_type]}`} />
                        <Campo label="Vencimiento" value={formatDateOnly(cuenta.fecha_vencimiento)} />
                        <Campo label="Correo" value={cuenta.email} />
                        <Campo
                            label="Contraseña"
                            secret
                            value={clave !== "cargando" && clave.ok ? clave.password : ""}
                            placeholder={clave === "cargando" ? "Consultando al proveedor..." : "--"}
                            error={clave !== "cargando" && !clave.ok ? clave.error : undefined}
                        />
                        <Campo label="Costo (proveedor)" value={cuenta.costo === null ? "" : formatCOP(cuenta.costo)} />
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold text-white">
                                Perfiles{lista.length > 0 && <span className="ml-1.5 text-secondary font-normal">({lista.length})</span>}
                            </h3>
                            <div className="flex items-center gap-3 text-xs">
                                {lista.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(lista.map((p) => p.id)))}
                                        className="cursor-pointer text-secondary transition hover:text-accent"
                                    >
                                        {todosAbiertos ? "Contraer todos" : "Expandir todos"}
                                    </button>
                                )}
                                <Link
                                    href={ruta(`/administrar/perfiles?cuenta=${cuenta.id}`)}
                                    className="group inline-flex items-center gap-1 text-secondary transition hover:text-accent"
                                >
                                    Abrir en Perfiles
                                    <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition group-hover:opacity-100" />
                                </Link>
                            </div>
                        </div>

                        {perfiles === "cargando" ? (
                            <p className="py-4 text-center text-sm text-secondary">Cargando perfiles...</p>
                        ) : perfiles === null ? (
                            <p className="py-4 text-center text-sm text-red-400">No se pudieron cargar los perfiles.</p>
                        ) : perfiles.length === 0 ? (
                            <p className="py-4 text-center text-sm text-secondary">Esta cuenta no tiene perfiles.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {perfiles.map((p) => (
                                    <PerfilItem key={p.id} perfil={p} clave={clavesPerfil === "cargando" ? "cargando" : clavesPerfil[p.id]} abierto={abiertos.has(p.id)} onToggle={() => toggle(p.id)} />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end">
                        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
                    </div>
                </div>
            )}
        </Modal>
    )
}
