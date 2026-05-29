import { useMemo, useState } from "react";
import { FlashcardRow } from "@/components/flashcards/FlashcardRow";
import { MAX_CARD_FIELD_CHARS, MAX_CARDS_PER_REQUEST, MAX_SOURCE_TEXT_CHARS } from "@/lib/ai-generation-limits";
import { dispatchDashboardSetCardsAdded } from "@/lib/dashboard-set-sync";
import { cn } from "@/lib/utils";

interface FlashcardSetOption {
  id: string;
  name: string;
}

interface FlashcardDraft {
  id: string;
  question: string;
  answer: string;
}

type SaveStatus = "idle" | "saving" | "success" | "error";

type GenerateResponse = { ok: true; cards: { question: string; answer: string }[] } | { ok: false; message: string };

type BulkCreateResponse = { ok: true; insertedCount: number } | { ok: false; message: string };

function createDraftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `draft_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function FlashcardGenerator({
  sets,
  initialSelectedSetId,
}: {
  sets: FlashcardSetOption[];
  initialSelectedSetId?: string;
}) {
  const defaultSetId = useMemo(() => {
    if (initialSelectedSetId) return initialSelectedSetId;
    return sets[0]?.id ?? "";
  }, [initialSelectedSetId, sets]);

  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [cardsDraft, setCardsDraft] = useState<FlashcardDraft[]>([]);
  const [selectedSetId, setSelectedSetId] = useState(defaultSetId);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const textTrimmed = text.trim();
  const canGenerate = !isGenerating && textTrimmed.length > 0;

  const canSave = saveStatus !== "saving" && cardsDraft.length > 0 && Boolean(selectedSetId);

  const saveDisabledReason = useMemo(() => {
    if (saveStatus === "saving") return "Saving…";
    if (sets.length === 0) return "Create a set first to save cards.";
    if (!selectedSetId) return "Choose a set to save to.";
    if (cardsDraft.length === 0) return "Add at least one card to save.";
    return null;
  }, [cardsDraft.length, saveStatus, selectedSetId, sets.length]);

  async function onGenerate() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSaveStatus("idle");

    const t = text.trim();
    if (!t) {
      setErrorMessage("Paste some text to generate flashcards.");
      return;
    }
    if (t.length > MAX_SOURCE_TEXT_CHARS) {
      setErrorMessage(`Text must be at most ${MAX_SOURCE_TEXT_CHARS} characters.`);
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });

      const body = await parseJson<GenerateResponse>(res);

      if (!body || !("ok" in body)) {
        setErrorMessage("Could not generate flashcards. Please try again.");
        return;
      }

      if (!body.ok) {
        setErrorMessage(body.message);
        return;
      }

      const drafts = body.cards.slice(0, MAX_CARDS_PER_REQUEST).map((c) => ({
        id: createDraftId(),
        question: c.question,
        answer: c.answer,
      }));

      setCardsDraft(drafts);
      if (drafts.length === 0) {
        setErrorMessage("No flashcards were generated. Please try again.");
      }
    } catch {
      setErrorMessage("Could not generate flashcards. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function updateDraft(id: string, patch: Partial<Pick<FlashcardDraft, "question" | "answer">>) {
    setCardsDraft((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteDraft(id: string) {
    setCardsDraft((prev) => prev.filter((c) => c.id !== id));
  }

  async function onSave() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSaveStatus("idle");

    if (!selectedSetId) {
      setErrorMessage("Choose a set to save to.");
      return;
    }
    if (cardsDraft.length === 0) {
      setErrorMessage("Add at least one card to save.");
      return;
    }

    setSaveStatus("saving");
    try {
      const payloadCards = cardsDraft.slice(0, MAX_CARDS_PER_REQUEST).map((c) => ({
        question: c.question,
        answer: c.answer,
      }));

      const res = await fetch("/api/flashcards/bulk-create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: selectedSetId, cards: payloadCards }),
      });

      const body = await parseJson<BulkCreateResponse>(res);

      if (!body || !("ok" in body)) {
        setSaveStatus("error");
        setErrorMessage("Could not save cards. Please try again.");
        return;
      }

      if (!body.ok) {
        setSaveStatus("error");
        setErrorMessage(body.message);
        return;
      }

      const setName = sets.find((s) => s.id === selectedSetId)?.name ?? "your set";
      setSaveStatus("success");
      setSuccessMessage(`Saved ${body.insertedCount} card(s) to ${setName}.`);
      dispatchDashboardSetCardsAdded({ setId: selectedSetId, addedCount: body.insertedCount });
      setText("");
      setCardsDraft([]);
    } catch {
      setSaveStatus("error");
      setErrorMessage("Could not save cards. Please try again.");
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-white">Generate flashcards</h2>
        <p className="text-sm text-blue-100/70">Paste text, generate Q&amp;A cards, edit them, then save to a set.</p>
      </div>

      {(errorMessage ?? successMessage) && (
        <div
          className={cn(
            "mt-4 rounded-xl border px-4 py-3 text-sm",
            errorMessage
              ? "border-red-400/20 bg-red-500/10 text-red-100"
              : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
          )}
        >
          {errorMessage ?? successMessage}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-white">Source text</label>
            <span
              className={cn(
                "font-mono text-xs",
                textTrimmed.length > MAX_SOURCE_TEXT_CHARS ? "text-red-200" : "text-blue-100/60",
              )}
            >
              {textTrimmed.length}/{MAX_SOURCE_TEXT_CHARS}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            rows={6}
            placeholder="Paste your notes here…"
            className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/20 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className={cn(
              "inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition-colors",
              canGenerate
                ? "bg-blue-500/20 text-white hover:bg-blue-500/30"
                : "cursor-not-allowed bg-white/5 text-white/40",
            )}
          >
            {isGenerating ? "Generating…" : "Generate"}
          </button>

          <div className="flex flex-col gap-1 sm:items-end">
            <label className="text-xs text-blue-100/60">Save to set</label>
            <select
              value={selectedSetId}
              onChange={(e) => {
                setSelectedSetId(e.target.value);
              }}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/20 focus:outline-none sm:w-[260px]"
            >
              {sets.length === 0 ? (
                <option value="">Create a set first…</option>
              ) : (
                <>
                  <option value="">Choose a set…</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Draft cards</h3>
            <span className="text-xs text-blue-100/60">
              {cardsDraft.length}/{MAX_CARDS_PER_REQUEST}
            </span>
          </div>

          {cardsDraft.length === 0 ? (
            <div className="mt-3 text-sm text-blue-100/70">
              Generate to see cards here. You can edit or delete before saving.
            </div>
          ) : (
            <ul className="mt-4 grid gap-3">
              {cardsDraft.map((c) => (
                <li key={c.id}>
                  <FlashcardRow
                    mode="draft"
                    question={c.question}
                    answer={c.answer}
                    onQuestionChange={(next) => {
                      updateDraft(c.id, { question: next });
                    }}
                    onAnswerChange={(next) => {
                      updateDraft(c.id, { answer: next });
                    }}
                    onRemove={() => {
                      deleteDraft(c.id);
                    }}
                    maxChars={MAX_CARD_FIELD_CHARS}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-blue-100/60">
              Save will insert up to {MAX_CARDS_PER_REQUEST} cards in one request.
            </div>
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave}
                className={cn(
                  "inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition-colors",
                  canSave
                    ? "bg-purple-500/20 text-white hover:bg-purple-500/30"
                    : "cursor-not-allowed bg-white/5 text-white/40",
                )}
              >
                {saveStatus === "saving" ? "Saving…" : "Save"}
              </button>
              {!canSave && saveDisabledReason && <div className="text-xs text-blue-100/60">{saveDisabledReason}</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
