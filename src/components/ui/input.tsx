import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white shadow-xs transition-colors outline-none placeholder:text-white/40 focus-visible:border-red-300/50 focus-visible:ring-[3px] focus-visible:ring-red-300/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
