import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_SET_NAME_LENGTH = 80;

type TriggerVariant = "primary" | "tile";

export function NewSetDialog({
  triggerLabel = "New set",
  triggerVariant = "tile",
}: {
  triggerLabel?: string;
  triggerVariant?: TriggerVariant;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerVariant === "tile" ? (
          <button
            type="button"
            className={cn(
              "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:bg-muted/50 flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm font-medium transition-colors",
            )}
          >
            <span className="text-2xl leading-none">+</span>
            {triggerLabel}
          </button>
        ) : (
          <Button type="button">{triggerLabel}</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form method="POST" action="/api/flashcard-sets/create" className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Create a new set</DialogTitle>
            <DialogDescription>Name must be 1–80 characters.</DialogDescription>
          </DialogHeader>
          <Input
            type="text"
            name="name"
            placeholder="e.g. Biology"
            maxLength={MAX_SET_NAME_LENGTH}
            required
            className={cn("border-border bg-background text-foreground placeholder:text-muted-foreground")}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
