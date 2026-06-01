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
import { useLocale } from "@/components/i18n/useLocale";
import { FLASHCARD_SET_NAME_MAX_LENGTH } from "@/lib/flashcard-set-name";
import { cn } from "@/lib/utils";

type TriggerVariant = "primary" | "tile";

type CreateSetResponse = { ok: true } | { ok: false; message: string };

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function NewSetDialog({
  triggerLabel,
  triggerVariant = "tile",
}: {
  triggerLabel?: string;
  triggerVariant?: TriggerVariant;
}) {
  const { t } = useLocale();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const label = triggerLabel ?? t("sets.new.trigger");

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/flashcard-sets/create", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const body = await parseJson<CreateSetResponse>(response);

      if (!body) {
        setErrorMessage(t("sets.error.create_failed"));
        setPending(false);
        return;
      }

      if (body.ok) {
        window.location.assign("/dashboard");
        return;
      }

      setErrorMessage(body.message);
      setPending(false);
    } catch {
      setErrorMessage(t("sets.error.create_failed"));
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setErrorMessage(null);
          setPending(false);
        }
      }}
    >
      <DialogTrigger asChild>
        {triggerVariant === "tile" ? (
          <button
            type="button"
            className={cn(
              "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:bg-muted/50 flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm font-medium transition-colors",
            )}
          >
            <span className="text-2xl leading-none">+</span>
            {label}
          </button>
        ) : (
          <Button type="button">{label}</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" closeLabel={t("a11y.close")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("sets.new.title")}</DialogTitle>
            <DialogDescription>{t("sets.new.description")}</DialogDescription>
          </DialogHeader>
          <Input
            type="text"
            name="name"
            placeholder={t("sets.new.placeholder")}
            maxLength={FLASHCARD_SET_NAME_MAX_LENGTH}
            required
            disabled={pending}
            className={cn("border-border bg-background text-foreground placeholder:text-muted-foreground")}
          />
          {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setOpen(false);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("sets.new.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
