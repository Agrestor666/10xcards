import * as React from "react";
import { FlashcardRow } from "@/components/flashcards/FlashcardRow";
import { Button } from "@/components/ui/button";
import { MAX_CARD_FIELD_CHARS } from "@/lib/ai-generation-limits";
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

export function SetFlashcardsManager({
  setId,
  setName,
  initialCards,
}: {
  setId: string;
  setName: string;
  initialCards: InitialCard[];
}) {
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
      showError("Both question and answer are required.");
      return;
    }
    if (q.length > MAX_CARD_FIELD_CHARS || a.length > MAX_CARD_FIELD_CHARS) {
      showError(`Each question and answer must be at most ${MAX_CARD_FIELD_CHARS} characters.`);
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
        showError("Could not add this card. Please try again.");
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
      showSuccess(`Added a card to ${setName}.`);
    } catch {
      showError("Could not add this card. Please try again.");
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
      updateCardLocal(id, { saveError: "Both question and answer are required." });
      return;
    }
    if (q.length > MAX_CARD_FIELD_CHARS || a.length > MAX_CARD_FIELD_CHARS) {
      updateCardLocal(id, {
        saveError: `Each question and answer must be at most ${MAX_CARD_FIELD_CHARS} characters.`,
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
        updateCardLocal(id, { saveError: "Could not save this card. Please try again." });
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
      showSuccess("Saved.");
    } catch {
      updateCardLocal(id, { saveError: "Could not save this card. Please try again." });
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
        showError("Could not delete this card. Please try again.");
        return;
      }
      if (!body.ok) {
        showError(body.message);
        return;
      }

      setCards((prev) => prev.filter((c) => c.id !== id));
      showSuccess("Deleted.");
    } catch {
      showError("Could not delete this card. Please try again.");
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
              ? "border-red-400/20 bg-red-500/10 text-red-100"
              : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
          )}
        >
          {errorMessage ?? successMessage}
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-white">Add a card</h2>
          <p className="text-sm text-blue-100/70">Create a new flashcard in {setName}.</p>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-white">Question</label>
              <textarea
                value={newQuestion}
                onChange={(e) => {
                  setNewQuestion(e.target.value);
                }}
                rows={3}
                maxLength={MAX_CARD_FIELD_CHARS}
                className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/20 focus:outline-none"
                placeholder="e.g. What is DNA?"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-white">Answer</label>
              <textarea
                value={newAnswer}
                onChange={(e) => {
                  setNewAnswer(e.target.value);
                }}
                rows={3}
                maxLength={MAX_CARD_FIELD_CHARS}
                className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/20 focus:outline-none"
                placeholder="e.g. Genetic material"
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button
              type="button"
              onClick={onAddCard}
              disabled={isAdding}
              className={cn("bg-purple-500/60 text-white hover:bg-purple-500/70")}
            >
              {isAdding ? "Adding…" : "Add card"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Cards</h2>
          <span className="text-xs text-blue-100/60">{cards.length} total</span>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {cards.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-blue-100/70">
              No cards yet. Add your first one above.
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
