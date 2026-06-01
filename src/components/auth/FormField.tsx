import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UiTheme } from "@/types";

const inputBaseCosmic =
  "w-full rounded-lg bg-white/10 border px-3 py-2 pl-10 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-colors";

const inputBasePaper =
  "border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 w-full rounded-lg border px-3 py-2 pl-10 text-sm focus:ring-2 focus:outline-none transition-colors";

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  icon: ReactNode;
  endContent?: ReactNode;
  /** Use native form values (works with browser autofill + POST). */
  uncontrolled?: boolean;
  /** Toggles password visibility via ref (avoids remounting the input). */
  passwordVisible?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onInput?: (event: React.InputEvent<HTMLInputElement>) => void;
  /** Paper-first default; cosmic branch kept for backward compatibility. */
  theme?: UiTheme;
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  placeholder,
  error,
  hint,
  icon,
  endContent,
  uncontrolled = false,
  passwordVisible,
  value,
  onChange,
  onInput,
  theme = "paper",
}: FormFieldProps) {
  const isPaper = theme === "paper";
  const inputType = passwordVisible !== undefined ? (passwordVisible ? "text" : "password") : type;
  const autoComplete =
    id === "email"
      ? "email"
      : id === "password"
        ? "current-password"
        : id === "confirmPassword"
          ? "new-password"
          : undefined;

  const labelClass = isPaper ? "text-muted-foreground mb-1 block text-sm" : "mb-1 block text-sm text-blue-100/80";
  const iconClass = isPaper
    ? "text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
    : "absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40";
  const errorClass = isPaper
    ? "text-destructive mt-1 flex items-center gap-1 text-xs"
    : "mt-1 flex items-center gap-1 text-xs text-red-300";

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <span className={iconClass}>{icon}</span>
        <input
          id={id}
          name={name ?? id}
          type={inputType}
          autoComplete={autoComplete}
          {...(uncontrolled
            ? { defaultValue: "" }
            : {
                value: value ?? "",
                onChange: (e) => {
                  onChange?.(e.target.value);
                },
              })}
          onInput={onInput}
          placeholder={placeholder}
          className={cn(
            isPaper ? inputBasePaper : inputBaseCosmic,
            endContent && "pr-11",
            error
              ? isPaper
                ? "border-destructive focus:ring-destructive/30"
                : "border-red-400/60 focus:ring-red-400"
              : isPaper
                ? "focus:ring-ring/30"
                : "border-white/20 focus:ring-purple-400",
          )}
        />
        {endContent ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-1">
            <div className="pointer-events-auto">{endContent}</div>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className={errorClass}>
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
