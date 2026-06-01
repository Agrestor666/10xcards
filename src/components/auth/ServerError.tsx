import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UiTheme } from "@/types";

interface ServerErrorProps {
  message?: string | null;
  theme?: UiTheme;
}

export function ServerError({ message, theme = "paper" }: ServerErrorProps) {
  if (!message) return null;

  const isPaper = theme === "paper";

  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        isPaper
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-red-500/30 bg-red-900/30 text-red-300",
      )}
    >
      <CircleAlert className="size-4 shrink-0" />
      {message}
    </p>
  );
}
