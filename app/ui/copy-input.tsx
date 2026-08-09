"use client"

import { useCallback, useRef, useState, forwardRef } from "react"
import { ClipboardCopy, Check } from "lucide-react"
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
}

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
            className = "",
            id,
            value,
            defaultValue,
            ...rest
        },
        ref,
    ) => {
        const [copied, setCopied] = useState(false)
        const inputRef = useRef<HTMLInputElement>(null)

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

        const copyToClipboard = async () => {
            const text = getCurrentText().trim()
            if (!text) return

            try {
                await navigator.clipboard.writeText(text)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1800)
            } catch {
                // ignore clipboard errors silently
            }
        }

        return (
            <Input
                ref={setRefs}
                id={id}
                label={label}
                error={error}
                message={message}
                leftIcon={leftIcon}
                required={required}
                validation={validation}
                value={value}
                defaultValue={defaultValue}
                className={className}
                rightIcon={
                    <button
                        type="button"
                        onClick={copyToClipboard}
                        aria-label={copied ? successLabel : copyLabel}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted transition-colors duration-200 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-1 focus:ring-offset-slate-950"
                    >
                        {copied ? (
                            <Check className="w-4 h-4 text-emerald-400 animate-bounce" />
                        ) : (
                            <ClipboardCopy className="w-4 h-4" />
                        )}
                    </button>
                }
                {...rest}
            />
        )
    },
)

CopyInput.displayName = "CopyInput"

export default CopyInput
