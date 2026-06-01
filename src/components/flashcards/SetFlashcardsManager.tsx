import * as React from "react";
import { FlashcardRow } from "@/components/flashcards/FlashcardRow";
import { Button } from "@/components/ui/button";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { useLocale } from "@/components/i18n/useLocale";
import { MAX_CARD_FIELD_CHARS } from "@/lib/ai-generation-limits";
import type { AppLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

interface InitialCard {
  id: string;
  question: string;
  answer: string;
  updated_at: string;
}

interface Card extends InitialCard {
  isSaving: boolean;
  isDeleting: boolean;
  saveError?: string;
}

type CreateResponse =
  | {
      ok: true;
      card: {
        id: string;
        set_id: string;
        question: string;
        answer: string;
        updated_at: string;
      };
    }
  | { ok: false; message: string };

type UpdateResponse =
  | {
      ok: true;
      card: {
        id: string;
        question: string;
        answer: string;
        updated_at: string;
      };
    }
  | { ok: false; message: string };

type DeleteResponse = { ok: true } | { ok: false; message: string };

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function SetFlashcardsManagerInner({
  setId,
  setName,
  initialCards,
}: {
  setId: string;
  setName: string;
  initialCards: InitialCard[];
}) {
  const { t } = useLocale();
  const [cards, setCards] = React.useState<Card[]>(
    initialCards.map((c) => ({ ...c, isSaving: false, isDeleting: false })),
  );

  const [newQuestion, setNewQuestion] = React.useState("");
  const [newAnswer, setNewAnswer] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  function showError(message: string) {
    setSuccessMessage(null);
    setErrorMessage(message);
  }

  function showSuccess(message: string) {
    setErrorMessage(null);
    setSuccessMessage(message);
    window.setTimeout(() => {
      setSuccessMessage((prev) => (prev === message ? null : prev));
    }, 2500);
  }

  function updateCardLocal(id: string, patch: Partial<Pick<Card, "question" | "answer" | "updated_at" | "saveError">>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function onAddCard() {
    setErrorMessage(null);
    setSuccessMessage(null);

    const q = newQuestion.trim();
    const a = newAnswer.trim();

    if (!q || !a) {
      showError(t("flashcards.error.both_required"));
      return;
    }
    if (q.length > MAX_CARD_FIELD_CHARS || a.length > MAX_CARD_FIELD_CHARS) {
      showError(t("flashcards.error.max_chars", { max: MAX_CARD_FIELD_CHARS }));
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch("/api/flashcards/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, question: q, answer: a }),
      });

      const body = await parseJson<CreateResponse>(res);
      if (!body || !("ok" in body)) {
        showError(t("flashcards.error.add"));
        return;
      }
      if (!body.ok) {
        showError(body.message);
        return;
      }

      setCards((prev) => [
        ...prev,
        {
          id: body.card.id,
          question: body.card.question,
          answer: body.card.answer,
          updated_at: body.card.updated_at,
          isSaving: false,
          isDeleting: false,
        },
      ]);
      setNewQuestion("");
      setNewAnswer("");
      showSuccess(t("flashcards.success.added", { setName }));
    } catch {
      showError(t("flashcards.error.add"));
    } finally {
      setIsAdding(false);
    }
  }

  async function onSaveCard(id: string) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const current = cards.find((c) => c.id === id);
    if (!current) return;

    const q = current.question.trim();
    const a = current.answer.trim();

    if (!q || !a) {
      updateCardLocal(id, { saveError: t("flashcards.error.both_required") });
      return;
    }
    if (q.length > MAX_CARD_FIELD_CHARS || a.length > MAX_CARD_FIELD_CHARS) {
      updateCardLocal(id, {
        saveError: t("flashcards.error.max_chars", { max: MAX_CARD_FIELD_CHARS }),
      });
      return;
    }

    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, isSaving: true, saveError: undefined } : c)));
    try {
      const res = await fetch("/api/flashcards/update", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, question: q, answer: a }),
      });

      const body = await parseJson<UpdateResponse>(res);
      if (!body || !("ok" in body)) {
        updateCardLocal(id, { saveError: t("flashcards.error.save") });
        return;
      }
      if (!body.ok) {
        updateCardLocal(id, { saveError: body.message });
        return;
      }

      setCards((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                question: body.card.question,
                answer: body.card.answer,
                updated_at: body.card.updated_at,
                isSaving: false,
                saveError: undefined,
              }
            : c,
        ),
      );
      showSuccess(t("flashcards.success.saved"));
    } catch {
      updateCardLocal(id, { saveError: t("flashcards.error.save") });
    } finally {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, isSaving: false } : c)));
    }
  }

  async function onDeleteCard(id: string) {
    setErrorMessage(null);
    setSuccessMessage(null);

    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, isDeleting: true, saveError: undefined } : c)));
    try {
      const res = await fetch("/api/flashcards/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const body = await parseJson<DeleteResponse>(res);
      if (!body || !("ok" in body)) {
        showError(t("flashcards.error.delete"));
        return;
      }
      if (!body.ok) {
        showError(body.message);
        return;
      }

      setCards((prev) => prev.filter((c) => c.id !== id));
      showSuccess(t("flashcards.success.deleted"));
    } catch {
      showError(t("flashcards.error.delete"));
    } finally {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, isDeleting: false } : c)));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {(errorMessage ?? successMessage) && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            errorMessage
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/10 text-foreground",
          )}
        >
          {errorMessage ?? successMessage}
        </div>
      )}

      <section className="border-border bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{t("flashcards.add.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("flashcards.add.description", { setName })}</p>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t("flashcards.field.question")}</label>
              <textarea
                value={newQuestion}
                onChange={(e) => {
                  setNewQuestion(e.target.value);
                }}
                rows={3}
                maxLength={MAX_CARD_FIELD_CHARS}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 w-full resize-y rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                placeholder={t("flashcards.placeholder.question")}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t("flashcards.field.answer")}</label>
              <textarea
                value={newAnswer}
                onChange={(e) => {
                  setNewAnswer(e.target.value);
                }}
                rows={3}
                maxLength={MAX_CARD_FIELD_CHARS}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 w-full resize-y rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                placeholder={t("flashcards.placeholder.answer")}
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button type="button" onClick={onAddCard} disabled={isAdding}>
              {isAdding ? t("flashcards.adding") : t("flashcards.add_card")}
            </Button>
          </div>
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("flashcards.cards.title")}</h2>
          <span className="text-muted-foreground text-xs">{t("flashcards.cards.total", { count: cards.length })}</span>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {cards.length === 0 ? (
            <div className="border-border bg-muted/50 text-muted-foreground rounded-xl border px-4 py-6 text-sm">
              {t("flashcards.empty")}
            </div>
          ) : (
            cards.map((c) => (
              <FlashcardRow
                key={c.id}
                mode="persisted"
                question={c.question}
                answer={c.answer}
                onQuestionChange={(next) => {
                  updateCardLocal(c.id, { question: next, saveError: undefined });
                }}
                onAnswerChange={(next) => {
                  updateCardLocal(c.id, { answer: next, saveError: undefined });
                }}
                onSave={() => {
                  void onSaveCard(c.id);
                }}
                onDelete={() => {
                  void onDeleteCard(c.id);
                }}
                isSaving={c.isSaving}
                isDeleting={c.isDeleting}
                saveError={c.saveError}
                maxChars={MAX_CARD_FIELD_CHARS}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function SetFlashcardsManager({
  locale,
  setId,
  setName,
  initialCards,
}: {
  locale: AppLocale;
  setId: string;
  setName: string;
  initialCards: InitialCard[];
}) {
  return (
    <LocaleProvider locale={locale}>
      <SetFlashcardsManagerInner setId={setId} setName={setName} initialCards={initialCards} />
    </LocaleProvider>
  );
}
