import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UiTheme } from "@/types";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
  theme?: UiTheme;
}

export function PasswordToggle({ visible, onToggle, theme = "cosmic" }: PasswordToggleProps) {
  const isPaper = theme === "paper";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors",
        isPaper
          ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          : "text-white/60 hover:bg-white/10 hover:text-white",
      )}
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
    >
      {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
    </button>
  );
}
