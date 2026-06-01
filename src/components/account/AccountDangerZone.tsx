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
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { useLocale } from "@/components/i18n/useLocale";
import { tPlural } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

const CONFIRM_TEXT = "DELETE";

type DeleteAccountResponse = { ok: true } | { ok: false; message: string };

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function AccountDangerZoneInner({
  email,
  setCount,
  cardCount,
  statsUnavailable = false,
}: {
  email: string;
  setCount: number;
  cardCount: number;
  statsUnavailable?: boolean;
}) {
  const { locale, t } = useLocale();
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
        setErrorMessage(t("account.danger_zone.error.delete"));
        return;
      }
      if (!body.ok) {
        setErrorMessage(body.message);
        return;
      }

      window.location.href = "/";
    } catch {
      setErrorMessage(t("account.danger_zone.error.delete"));
    } finally {
      setBusy(false);
    }
  }

  const dataSummary = statsUnavailable
    ? t("account.danger_zone.data_fallback")
    : t("account.danger_zone.data_sets_cards", {
        setPhrase: tPlural(locale, "account.danger_zone.set", setCount),
        and: t("common.and"),
        cardPhrase: tPlural(locale, "account.danger_zone.card", cardCount),
      });

  const dialogDataSummary = statsUnavailable
    ? t("account.danger_zone.dialog.data_fallback")
    : `${tPlural(locale, "account.danger_zone.set", setCount)}, ${t("common.and")} ${tPlural(locale, "account.danger_zone.card", cardCount)}`;

  return (
    <section className="border-border bg-card mt-4 rounded-2xl border p-6 shadow-sm">
      <h2 className="text-destructive text-lg font-semibold">{t("account.danger_zone.title")}</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        {t("account.danger_zone.description", { email, dataSummary })}
      </p>

      {errorMessage && !dialogOpen && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-xl border px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="mt-4">
        <Button type="button" variant="destructive" disabled={busy} onClick={openDialog}>
          {t("account.danger_zone.delete_button")}
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
            <AlertDialogTitle>{t("account.danger_zone.dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("account.danger_zone.dialog.description", {
                dataSummary: dialogDataSummary,
                confirmToken: CONFIRM_TEXT,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            type="text"
            value={confirmText}
            autoComplete="off"
            disabled={busy}
            placeholder={CONFIRM_TEXT}
            aria-label={t("account.danger_zone.dialog.confirm_aria", { confirmToken: CONFIRM_TEXT })}
            onChange={(e) => {
              setConfirmText(e.target.value);
            }}
          />

          {errorMessage && dialogOpen && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm">
              {errorMessage}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm}
              onClick={(e) => {
                e.preventDefault();
                void deleteAccount();
              }}
            >
              {busy ? t("common.deleting") : t("account.danger_zone.delete_button")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function AccountDangerZone({
  locale,
  email,
  setCount,
  cardCount,
  statsUnavailable = false,
}: {
  locale: AppLocale;
  email: string;
  setCount: number;
  cardCount: number;
  statsUnavailable?: boolean;
}) {
  return (
    <LocaleProvider locale={locale}>
      <AccountDangerZoneInner
        email={email}
        setCount={setCount}
        cardCount={cardCount}
        statsUnavailable={statsUnavailable}
      />
    </LocaleProvider>
  );
}
