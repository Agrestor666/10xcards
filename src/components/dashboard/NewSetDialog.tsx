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
import {
  flashcardSetErrorMessage,
  isFlashcardSetErrorKey,
  type FlashcardSetErrorKey,
} from "@/lib/flashcard-set-errors";
import { cn } from "@/lib/utils";

const MAX_SET_NAME_LENGTH = 80;

type TriggerVariant = "primary" | "tile";

type CreateSetResponse = { ok: true } | { ok: false; errorKey: FlashcardSetErrorKey };

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
  const { locale, t } = useLocale();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const label = triggerLabel ?? t("sets.new.trigger");

  function showErrorKey(errorKey: FlashcardSetErrorKey) {
    const params = errorKey === "set_name_max" ? { max: MAX_SET_NAME_LENGTH } : undefined;
    setErrorMessage(flashcardSetErrorMessage(locale, errorKey, params));
  }

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
        showErrorKey("set_create_failed");
        setPending(false);
        return;
      }

      if (body.ok) {
        window.location.assign("/dashboard");
        return;
      }

      showErrorKey(isFlashcardSetErrorKey(body.errorKey) ? body.errorKey : "set_create_failed");
      setPending(false);
    } catch {
      showErrorKey("set_create_failed");
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
            maxLength={MAX_SET_NAME_LENGTH}
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
