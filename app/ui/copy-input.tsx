"use client"

import { useCallback, useEffect, useRef, useState, forwardRef } from "react"
import { ClipboardCopy, Check, Eye, EyeOff, X } from "lucide-react"
import Input, { type ValidationState } from "@ui/input"

interface CopyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
    label?: string;
    error?: string | string[];
    message?: string | string[];
    leftIcon?: React.ReactNode;
    required?: boolean;
    validation?: ValidationState;
    copyLabel?: string;
    successLabel?: string;
    /** Dato sensible (contraseña): se muestra oculto con un botón para revelarlo; copiar sigue copiando el valor real. */
    secret?: boolean;
}

type CopyState = "idle" | "copied" | "failed"

const ICON_BUTTON =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors duration-200 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"

const CopyInput = forwardRef<HTMLInputElement, CopyInputProps>(
    (
        {
            label,
            error,
            message,
            leftIcon,
            required,
            validation,
            copyLabel = "Copiar",
            successLabel = "Copiado",
            secret = false,
            className = "",
            id,
            value,
            defaultValue,
            ...rest
        },
        ref,
    ) => {
        const [state, setState] = useState<CopyState>("idle")
        const [revealed, setRevealed] = useState(false)
        const inputRef = useRef<HTMLInputElement>(null)
        const timer = useRef<number | undefined>(undefined)

        useEffect(() => () => window.clearTimeout(timer.current), [])

        const setRefs = useCallback(
            (node: HTMLInputElement | null) => {
                inputRef.current = node

                if (!ref) return
                if (typeof ref === "function") {
                    ref(node)
                } else {
                    (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
                }
            },
            [ref],
        )

        const getCurrentText = () => {
            if (inputRef.current) {
                return inputRef.current.value
            }

            if (value !== undefined) {
                return String(value ?? "")
            }

            if (defaultValue !== undefined) {
                return String(defaultValue ?? "")
            }

            return ""
        }

        const flash = (next: CopyState) => {
            setState(next)
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => setState("idle"), next === "failed" ? 3000 : 1800)
        }

        const copyToClipboard = async () => {
            const text = getCurrentText().trim()
            if (!text) return

            try {
                // Sin contexto seguro (http) navigator.clipboard no existe: también cuenta como fallo.
                await navigator.clipboard.writeText(text)
                flash("copied")
            } catch {
                flash("failed")
            }
        }

        const copyAria = state === "copied" ? successLabel : state === "failed" ? "No se pudo copiar" : copyLabel

        return (
            <div className="relative">
                <Input
                    ref={setRefs}
                    id={id}
                    type={secret && !revealed ? "password" : "text"}
                    label={label}
                    error={error}
                    message={message}
                    leftIcon={leftIcon}
                    required={required}
                    validation={validation}
                    value={value}
                    defaultValue={defaultValue}
                    className={className}
                    rightIconWide={secret}
                    rightIcon={
                        <>
                            {secret && (
                                <button
                                    type="button"
                                    onClick={() => setRevealed((v) => !v)}
                                    aria-label="Mostrar contraseña"
                                    aria-pressed={revealed}
                                    title={revealed ? "Ocultar" : "Mostrar"}
                                    className={ICON_BUTTON}
                                >
                                    {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={copyToClipboard}
                                aria-label={copyAria}
                                title={copyAria}
                                className={ICON_BUTTON}
                            >
                                {state === "copied" ? (
                                    <Check className="w-4 h-4 text-emerald-400" />
                                ) : state === "failed" ? (
                                    <X className="w-4 h-4 text-red-400" />
                                ) : (
                                    <ClipboardCopy className="w-4 h-4" />
                                )}
                            </button>
                        </>
                    }
                    {...rest}
                />
                {/* Anuncio para lectores de pantalla; a la vista queda el ícono y, si falla, el texto bajo el campo. */}
                <span className="sr-only" aria-live="polite">
                    {state === "copied" ? successLabel : state === "failed" ? "No se pudo copiar" : ""}
                </span>
                {state === "failed" && (
                    <p className="absolute right-0 top-full -mt-5 text-xs text-red-400" aria-hidden="true">No se pudo copiar</p>
                )}
            </div>
        )
    },
)

CopyInput.displayName = "CopyInput"

export default CopyInput
