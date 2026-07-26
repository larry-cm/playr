"use client";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { TriangleAlert, ChevronDown, Search } from "lucide-react";
import type { ValidationState } from "@ui/input";

export interface DropdownOption {
  value: string;
  label: string;
  dropdownLabel?: string;
  icon?: ReactNode;
}

interface SelectDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string | string[];
  required?: boolean;
  className?: string;
  name?: string;
  id?: string;
  validation?: ValidationState;
}

const borderByValidation: Record<ValidationState, string> = {
  idle: "border-white/[0.1]",
  valid: "border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-400/40",
  invalid: "border-red-500/50 focus:border-red-400 focus:ring-red-400/40",
};

export default function SelectDropdown({
  options,
  value,
  onChange,
  label,
  placeholder = "Seleccionar...",
  error,
  required,
  className = "",
  name,
  id,
  validation,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = search
    ? options.filter((o) => {
        const text = o.dropdownLabel ?? o.label;
        return text.toLowerCase().includes(search.toLowerCase());
      })
    : options;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt: DropdownOption) => {
    onChange(opt.value);
    setOpen(false);
    setSearch("");
  };

  const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setSearch(e.key);
      setOpen(true);
    }
  };

  const focusSearchInput = (el: HTMLInputElement | null) => {
    if (el && open) {
      el.focus();
      if (search) {
        el.setSelectionRange(search.length, search.length);
      }
    }
  };

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-secondary">
          {label}{required && <span className="text-accent ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <input type="hidden" name={name} value={value} />

        <button
          type="button"
          id={id}
          onClick={() => setOpen(!open)}
          onKeyDown={handleButtonKeyDown}
          className={`w-full flex items-center gap-2 bg-white/[0.05] border rounded-xl py-2.5 pl-3.5 pr-10 text-sm text-white outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/40 ${borderByValidation[validation ?? "idle"]} ${className}`}
        >
          {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
          <span className={`truncate ${selected ? "text-white" : "text-muted"}`}>
            {selected ? selected.label : placeholder}
          </span>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted shrink-0 pointer-events-none">
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-1.5 w-full bg-[#0a0a0f] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
            <div className="relative border-b border-white/[0.06]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                ref={focusSearchInput}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-white placeholder-muted outline-none"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="py-3 px-3.5 text-sm text-muted text-center">
                  Sin resultados
                </p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-left transition-colors hover:bg-white/5 ${
                      opt.value === value
                        ? "text-accent bg-accent/5"
                        : "text-white"
                    }`}
                  >
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="truncate">{opt.dropdownLabel ?? opt.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {(Array.isArray(error) ? error : [error]).map((msg, i) => (
            <p key={i} className="text-red-400 text-xs flex items-center gap-1">
              <TriangleAlert className="w-3 h-3 shrink-0" />
              {msg}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
