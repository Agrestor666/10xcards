import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CONFIRM_TEXT = "DELETE";

type DeleteAccountResponse = { ok: true } | { ok: false; message: string };

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface AccountDangerZoneProps {
  email: string;
  setCount: number;
  cardCount: number;
}

export function AccountDangerZone({ email, setCount, cardCount }: AccountDangerZoneProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const canConfirm = confirmText === CONFIRM_TEXT && !busy;

  function resetDialog() {
    setConfirmText("");
    setErrorMessage(null);
  }

  function openDialog() {
    resetDialog();
    setDialogOpen(true);
  }

  async function deleteAccount() {
    if (!canConfirm) return;

    setErrorMessage(null);
    setBusy(true);

    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRM_TEXT }),
      });

      const body = await parseJson<DeleteAccountResponse>(res);
      if (!body || !("ok" in body)) {
        setErrorMessage("Could not delete your account. Please try again.");
        return;
      }
      if (!body.ok) {
        setErrorMessage(body.message);
        return;
      }

      window.location.href = "/";
    } catch {
      setErrorMessage("Could not delete your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const setLabel = setCount === 1 ? "set" : "sets";
  const cardLabel = cardCount === 1 ? "flashcard" : "flashcards";

  return (
    <section className="rounded-2xl border border-red-400/30 bg-red-500/5 p-6 backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-red-100">Danger zone</h2>
      <p className="mt-2 text-sm text-blue-100/80">
        Permanently delete the account <strong className="text-white">{email}</strong> and all associated data. This
        removes <strong className="text-white">{setCount}</strong> {setLabel} and{" "}
        <strong className="text-white">{cardCount}</strong> {cardLabel}. This cannot be undone.
      </p>

      {errorMessage && !dialogOpen && (
        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {errorMessage}
        </div>
      )}

      <div className="mt-4">
        <Button
          type="button"
          variant="destructive"
          className={cn("bg-red-500/80 hover:bg-red-500")}
          disabled={busy}
          onClick={openDialog}
        >
          Delete account
        </Button>
      </div>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && busy) return;
          setDialogOpen(open);
          if (!open) {
            resetDialog();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, <strong className="text-white">{setCount}</strong> {setLabel},
              and <strong className="text-white">{cardCount}</strong> {cardLabel}. Type{" "}
              <strong className="text-white">{CONFIRM_TEXT}</strong> below to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            type="text"
            value={confirmText}
            autoComplete="off"
            disabled={busy}
            placeholder={CONFIRM_TEXT}
            aria-label={`Type ${CONFIRM_TEXT} to confirm`}
            onChange={(e) => {
              setConfirmText(e.target.value);
            }}
          />

          {errorMessage && dialogOpen && (
            <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {errorMessage}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm}
              className={cn("bg-red-500/80 hover:bg-red-500")}
              onClick={(e) => {
                e.preventDefault();
                void deleteAccount();
              }}
            >
              {busy ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
