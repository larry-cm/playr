"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@ui/button";
import Modal from "@ui/modal";
import { Eye, Edit, Trash2, Search, Plus } from "lucide-react";

interface TableProps<T extends Record<string, unknown>> {
    header: string[];
    data: T[];
    className?: string;
    showActions?: boolean;
}

const formatCellValue = (value: unknown) => {
    if (value === null || value === undefined) {
        return "--";
    }

    if (typeof value === "boolean") {
        return value ? "Sí" : "No";
    }

    if (Array.isArray(value)) {
        return value.join(", ");
    }

    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
};

export default function Table<T extends Record<string, unknown>>({
    header,
    data,
    className = "",
    showActions = true,
}: Readonly<TableProps<T>>) {
    const [rows, setRows] = useState<T[]>(data);
    const [viewRow, setViewRow] = useState<T | null>(null);
    const [editRowIndex, setEditRowIndex] = useState<number | null>(null);
    const [editedRow, setEditedRow] = useState<Record<string, any> | null>(null);
    const [isConfirmIndex, setIsConfirmIndex] = useState<number | null>(null);
    const [search, setSearch] = useState("");

    useEffect(() => {
        setRows(data);
    }, [data]);

    const openView = (row: T) => setViewRow(row);
    const closeView = () => setViewRow(null);

    const openEdit = (row: T, index: number) => {
        setEditRowIndex(index);
        const copy: Record<string, any> = {};
        header.forEach((h) => (copy[h] = (row as any)[h]));
        setEditedRow(copy);
    };

    const closeEdit = () => {
        setEditRowIndex(null);
        setEditedRow(null);
    };

    const saveEdit = () => {
        if (editRowIndex === null || editedRow === null) return;
        setRows((prev) => {
            const next = [...prev];
            next[editRowIndex] = editedRow as unknown as T;
            return next;
        });
        closeEdit();
    };

    const confirmDelete = (index: number) => setIsConfirmIndex(index);
    const cancelDelete = () => setIsConfirmIndex(null);
    const doDelete = () => {
        if (isConfirmIndex === null) return;
        setRows((prev) => prev.filter((_, i) => i !== isConfirmIndex));
        setIsConfirmIndex(null);
    };

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return rows;

        return rows.filter((row) =>
            header.some((column) => {
                const value = (row as any)[column];
                if (value === null || value === undefined) return false;
                const text = formatCellValue(value).toLowerCase();
                return text.includes(query);
            }),
        );
    }, [rows, search, header]);

    return (
        <div className={`w-full ${className}`} style={{ color: 'var(--color-foreground)' }}>
            {/* Desktop / wide: standard polished table frame */}
            <div className="hidden md:block relative">
                <div
                    className="overflow-hidden rounded-2xl"
                    style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 8px 24px rgba(2,6,23,0.28), inset 0 1px 0 rgba(255,255,255,0.04)',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <div className="p-4">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative w-full sm:max-w-sm">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-secondary)' }} />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar"
                                    className="w-full rounded-xl border border-white/10 bg-white/3 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
                                />
                            </div>

                            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                                Agregar
                            </Button>
                        </div>

                        <table className="w-full border-collapse text-left text-sm" style={{ color: 'var(--color-foreground)' }}>
                            <thead>
                                <tr>
                                    {header.map((column) => (
                                        <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-secondary)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                            {column}
                                        </th>
                                    ))}
                                    {showActions && (
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-secondary)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                            Acciones
                                        </th>
                                    )}
                                </tr>
                            </thead>

                            <tbody>
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={header.length + (showActions ? 1 : 0)} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-secondary)' }}>
                                            No hay datos disponibles.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row, rowIndex) => (
                                        <tr key={rowIndex} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openView(row); }} className="group transition-colors hover:bg-white/3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25">
                                            {header.map((column, colIndex) => (
                                                <td key={`${rowIndex}-${column}`} className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div
                                                        style={{
                                                            color: 'var(--color-foreground)',
                                                            fontWeight: colIndex === 0 ? 600 : 400
                                                        }}>
                                                        {formatCellValue((row as any)[column])}</div>
                                                </td>
                                            ))}

                                            {showActions && (
                                                <td className="px-4 py-4 align-middle text-right" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div className="inline-flex items-center gap-2 *:cursor-pointer">
                                                        <button
                                                            type="button"
                                                            onClick={() => openView(row)}
                                                            aria-label="Ver"
                                                            title="Ver"
                                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-(--color-accent)/10 hover:text-(--color-accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(row, rowIndex)}
                                                            aria-label="Editar"
                                                            title="Editar"
                                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-(--color-accent)/10 hover:text-(--color-accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => confirmDelete(rowIndex)}
                                                            aria-label="Eliminar"
                                                            title="Eliminar"
                                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-400 transition-all duration-200 hover:border-red-400/30 hover:bg-red-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/25"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Mobile: polished card frame */}
            <div className="md:hidden flex flex-col gap-3">
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/3 p-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-secondary)' }} />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar"
                            className="w-full rounded-xl border border-white/10 bg-white/3 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
                        />
                    </div>
                    <Button size="sm" variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                        Agregar
                    </Button>
                </div>

                {filteredRows.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-secondary)' }}>No hay datos disponibles.</div>
                ) : (
                    filteredRows.map((row, rowIndex) => (
                        <div key={rowIndex} className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 6px 16px rgba(2,6,23,0.25)' }}>
                            <div className="p-4">
                                {header.map((column) => (
                                    <div key={`${rowIndex}-${column}`} className="flex items-start justify-between gap-3 py-2">
                                        <div className="text-xs font-medium" style={{ color: 'var(--color-secondary)' }}>{column}</div>
                                        <div className="text-sm" style={{ color: 'var(--color-foreground)' }}>{formatCellValue((row as any)[column])}</div>
                                    </div>
                                ))}

                                {showActions && (
                                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 *:cursor-pointer">
                                        <button
                                            type="button"
                                            onClick={() => openView(row)}
                                            className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 px-3 text-sm text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-(--color-accent)/10 hover:text-(--color-accent)"
                                        >
                                            <Eye className="mr-2 h-4 w-4" />Ver
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openEdit(row, rowIndex)}
                                            className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 px-3 text-sm text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-(--color-accent)/10 hover:text-(--color-accent)"
                                        >
                                            <Edit className="mr-2 h-4 w-4" />Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => confirmDelete(rowIndex)}
                                            className="inline-flex h-9 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 px-3 text-sm text-red-400 transition-all duration-200 hover:border-red-400/30 hover:bg-red-500/15"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />Eliminar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* View Modal */}
            <Modal isOpen={!!viewRow} title="Ver registro" onClose={closeView}>
                <pre className="whitespace-pre-wrap text-xs bg-white/3 p-3 rounded">{viewRow ? JSON.stringify(viewRow, null, 2) : ""}</pre>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={editRowIndex !== null} title={editRowIndex !== null ? `Editar registro #${editRowIndex + 1}` : undefined} onClose={closeEdit}>
                {editedRow && (
                    <div className="flex flex-col gap-3">
                        {header.map((column) => {
                            const val = editedRow[column];
                            const isBool = typeof val === "boolean";
                            return (
                                <div key={column} className="flex flex-col gap-1">
                                    <label className="text-xs text-secondary font-medium">{column}</label>
                                    {isBool ? (
                                        <label className="inline-flex items-center gap-2">
                                            <input type="checkbox" checked={!!val} onChange={(e) => setEditedRow({ ...editedRow, [column]: e.target.checked })} />
                                            <span className="text-sm text-white/90">{(editedRow as any)[column] ? "Sí" : "No"}</span>
                                        </label>
                                    ) : Array.isArray(val) || typeof val === "object" ? (
                                        <textarea className="w-full bg-white/3 p-2 rounded text-sm" rows={3} value={JSON.stringify(val)} onChange={(e) => {
                                            try { setEditedRow({ ...editedRow, [column]: JSON.parse(e.target.value) }); } catch { setEditedRow({ ...editedRow, [column]: e.target.value }); }
                                        }} />
                                    ) : (
                                        <input className="w-full bg-white/3 p-2 rounded text-sm" value={String(val ?? "")} onChange={(e) => setEditedRow({ ...editedRow, [column]: e.target.value })} />
                                    )}
                                </div>
                            );
                        })}

                        <div className="flex items-center justify-end gap-2 mt-2">
                            <Button variant="ghost" size="sm" onClick={closeEdit}>Cancelar</Button>
                            <Button variant="primary" size="sm" onClick={saveEdit}>Guardar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirm Delete Modal */}
            <Modal isOpen={isConfirmIndex !== null} title="Confirmar eliminación" onClose={cancelDelete}>
                <div className="text-sm text-white/90">¿Eliminar este registro? Esta acción no se puede deshacer.</div>
                <div className="flex items-center justify-end gap-2 mt-4">
                    <Button variant="ghost" size="sm" onClick={cancelDelete}>Cancelar</Button>
                    <Button variant="primary" size="sm" onClick={doDelete}>Eliminar</Button>
                </div>
            </Modal>
        </div>
    );
}
