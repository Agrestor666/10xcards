import * as React from "react";
import { Button } from "@/components/ui/button";
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
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      {triggerVariant === "tile" ? (
        <button
          type="button"
          onClick={openDialog}
          className={cn(
            "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:bg-muted/50 flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm font-medium transition-colors",
          )}
        >
          <span className="text-2xl leading-none">+</span>
          {triggerLabel}
        </button>
      ) : (
        <Button type="button" onClick={openDialog}>
          {triggerLabel}
        </Button>
      )}

      <dialog
        ref={dialogRef}
        className={cn(
          "border-border bg-card text-foreground fixed top-1/2 left-1/2 z-50 w-[min(100%-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-lg backdrop:bg-black/50",
        )}
        onClose={() => {
          /* native close */
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) {
            closeDialog();
          }
        }}
      >
        <form method="POST" action="/api/flashcard-sets/create" className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Create a new set</h2>
            <p className="text-muted-foreground mt-1 text-sm">Name must be 1–80 characters.</p>
          </div>
          <Input
            type="text"
            name="name"
            placeholder="e.g. Biology"
            maxLength={MAX_SET_NAME_LENGTH}
            required
            className={cn("border-border bg-background text-foreground placeholder:text-muted-foreground")}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
