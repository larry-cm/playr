"use client";
import { countries, getCountryByCode } from "@lib/countries";
import { TriangleAlert, Phone } from "lucide-react";
import SelectDropdown from "@ui/select-dropdown";
import type { ChangeEvent } from "react";
import type { ValidationState } from "@ui/input";

const countryOptions = countries.map((c) => ({
  value: c.code,
  label: "",
  icon: <span className="leading-none">{c.flag}</span>,
}));

const borderByValidation: Record<ValidationState, string> = {
  idle: "border-white/[0.1]",
  valid: "border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-400/40",
  invalid: "border-red-500/50 focus:border-red-400 focus:ring-red-400/40",
};

interface PhoneInputProps {
  codeValue?: string;
  numberValue?: string;
  onCodeChange?: (value: string) => void;
  onNumberChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  codeError?: string | string[];
  numberError?: string | string[];
  label?: string;
  numberPlaceholder?: string;
  required?: boolean;
  validation?: ValidationState;
}

export default function PhoneInput({
  codeValue = "+52",
  numberValue = "",
  onCodeChange,
  onNumberChange,
  onBlur,
  codeError,
  numberError,
  label = "Celular",
  numberPlaceholder = "123 456 7890",
  required,
  validation,
}: PhoneInputProps) {
  const country = getCountryByCode(codeValue);
  const maxDigits = country?.maxDigits ?? 10;

  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
    if (onNumberChange) {
      onNumberChange({
        ...e,
        target: { ...e.target, value: digits },
        currentTarget: { ...e.currentTarget, value: digits },
      } as ChangeEvent<HTMLInputElement>);
    }
  };

  const allErrors = [
    ...(Array.isArray(codeError) ? codeError : codeError ? [codeError] : []),
    ...(Array.isArray(numberError) ? numberError : numberError ? [numberError] : []),
  ];

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-secondary">{label}{required && <span className="text-accent ml-0.5">*</span>}</label>
      )}
      <div className="flex gap-2">
        <div className="w-[72px] shrink-0">
          <SelectDropdown
            options={countryOptions}
            value={codeValue}
            onChange={(val) => {
              onCodeChange?.(val);
              const newCountry = getCountryByCode(val);
              const newMax = newCountry?.maxDigits ?? 10;
              const currentDigits = numberValue.replace(/\D/g, "");
              if (currentDigits.length > newMax) {
                const truncated = currentDigits.slice(0, newMax);
                if (onNumberChange) {
                  onNumberChange({
                    target: { value: truncated },
                    currentTarget: { value: truncated },
                  } as ChangeEvent<HTMLInputElement>);
                }
              }
            }}
            name="celular_codigo"
          />
        </div>

        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none shrink-0">
            <Phone className="w-4 h-4" />
          </div>
          <input
            name="celular_numero"
            type="tel"
            value={numberValue}
            onChange={handleNumberChange}
            onBlur={onBlur}
            placeholder={numberPlaceholder}
            maxLength={maxDigits}
            className={`w-full bg-white/[0.05] border rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-muted outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/40 ${borderByValidation[validation ?? "idle"]}`}
          />
        </div>
      </div>
      {allErrors.length > 0 && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {allErrors.map((msg, i) => (
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
