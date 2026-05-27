import { useEffect, useRef, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const inputBase =
  "w-full rounded-lg bg-white/10 border px-3 py-2 pl-10 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-colors";

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
}: FormFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (passwordVisible === undefined || !inputRef.current) {
      return;
    }
    inputRef.current.type = passwordVisible ? "text" : "password";
  }, [passwordVisible]);

  const inputType = passwordVisible !== undefined ? (passwordVisible ? "text" : "password") : type;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-blue-100/80">
        {label}
      </label>
      <div className="relative">
        <span className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40">{icon}</span>
        <input
          ref={inputRef}
          id={id}
          name={name ?? id}
          type={inputType}
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
            inputBase,
            endContent && "pr-10",
            error ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
          )}
        />
        {endContent}
      </div>
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
