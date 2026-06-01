import { useMemo, useState } from "react";
import { FlashcardRow } from "@/components/flashcards/FlashcardRow";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { useLocale } from "@/components/i18n/useLocale";
import { MAX_CARD_FIELD_CHARS, MAX_CARDS_PER_REQUEST, MAX_SOURCE_TEXT_CHARS } from "@/lib/ai-generation-limits";
import { dispatchDashboardSetCardsAdded } from "@/lib/dashboard-set-sync";
import type { MessageKey } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";
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

type GenerateResponse =
  | { ok: true; cards: { question: string; answer: string }[] }
  | { ok: false; errorKey?: string; message?: string };

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

function FlashcardGeneratorInner({
  sets,
  initialSelectedSetId,
}: {
  sets: FlashcardSetOption[];
  initialSelectedSetId?: string;
}) {
  const { t } = useLocale();

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
    if (saveStatus === "saving") return t("common.saving");
    if (sets.length === 0) return t("generator.error.create_set_first");
    if (!selectedSetId) return t("generator.error.choose_set");
    if (cardsDraft.length === 0) return t("generator.error.add_card");
    return null;
  }, [cardsDraft.length, saveStatus, selectedSetId, sets.length, t]);

  async function onGenerate() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSaveStatus("idle");

    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMessage(t("generator.error.paste_text"));
      return;
    }
    if (trimmed.length > MAX_SOURCE_TEXT_CHARS) {
      setErrorMessage(t("generator.error.text_max", { max: MAX_SOURCE_TEXT_CHARS }));
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      const body = await parseJson<GenerateResponse>(res);

      if (!body || !("ok" in body)) {
        setErrorMessage(t("generator.error.generate"));
        return;
      }

      if (!body.ok) {
        if (body.message) {
          setErrorMessage(body.message);
        } else if (body.errorKey) {
          setErrorMessage(t(body.errorKey as MessageKey));
        } else {
          setErrorMessage(t("generator.error.generate"));
        }
        return;
      }

      const drafts = body.cards.slice(0, MAX_CARDS_PER_REQUEST).map((c) => ({
        id: createDraftId(),
        question: c.question,
        answer: c.answer,
      }));

      setCardsDraft(drafts);
      if (drafts.length === 0) {
        setErrorMessage(t("generator.error.no_cards"));
      }
    } catch {
      setErrorMessage(t("generator.error.generate"));
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
      setErrorMessage(t("generator.error.choose_set"));
      return;
    }
    if (cardsDraft.length === 0) {
      setErrorMessage(t("generator.error.add_card"));
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
        setErrorMessage(t("generator.error.save"));
        return;
      }

      if (!body.ok) {
        setSaveStatus("error");
        setErrorMessage(body.message);
        return;
      }

      const setName = sets.find((s) => s.id === selectedSetId)?.name ?? t("generator.your_set");
      setSaveStatus("success");
      setSuccessMessage(t("generator.success.saved", { count: body.insertedCount, setName }));
      dispatchDashboardSetCardsAdded({
        setId: selectedSetId,
        addedCount: body.insertedCount,
        dueAddedCount: body.insertedCount,
      });
      setText("");
      setCardsDraft([]);
    } catch {
      setSaveStatus("error");
      setErrorMessage(t("generator.error.save"));
    }
  }

  return (
    <section className="text-foreground pt-4">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{t("generator.description")}</p>
      </div>

      {(errorMessage ?? successMessage) && (
        <div
          className={cn(
            "mt-4 rounded-xl border px-4 py-3 text-sm",
            errorMessage
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/10 text-foreground",
          )}
        >
          {errorMessage ?? successMessage}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">{t("generator.source_text")}</label>
            <span
              className={cn(
                "text-muted-foreground font-mono text-xs",
                textTrimmed.length > MAX_SOURCE_TEXT_CHARS && "text-destructive",
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
            placeholder={t("generator.placeholder")}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 w-full resize-y rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className={cn(
              "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              canGenerate
                ? "border-border bg-primary/15 hover:bg-primary/25"
                : "border-border bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            {isGenerating ? t("generator.generating") : t("generator.generate")}
          </button>

          <div className="flex flex-col gap-1 sm:items-end">
            <label className="text-muted-foreground text-xs">{t("generator.save_to_set")}</label>
            <select
              value={selectedSetId}
              onChange={(e) => {
                setSelectedSetId(e.target.value);
              }}
              className="border-border bg-background text-foreground focus:border-ring focus:ring-ring/30 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none sm:w-[260px]"
            >
              {sets.length === 0 ? (
                <option value="">{t("generator.no_sets_option")}</option>
              ) : (
                <>
                  <option value="">{t("generator.choose_set_option")}</option>
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

        <div className="border-border bg-card mt-2 rounded-xl border p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{t("generator.draft_cards")}</h3>
            <span className="text-muted-foreground text-xs">
              {cardsDraft.length}/{MAX_CARDS_PER_REQUEST}
            </span>
          </div>

          {cardsDraft.length === 0 ? (
            <div className="text-muted-foreground mt-3 text-sm">{t("generator.draft_empty")}</div>
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
            <div className="text-muted-foreground text-xs">
              {t("generator.save_hint", { max: MAX_CARDS_PER_REQUEST })}
            </div>
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave}
                className={cn(
                  "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  canSave
                    ? "border-border bg-primary text-primary-foreground hover:opacity-90"
                    : "border-border bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {saveStatus === "saving" ? t("common.saving") : t("common.save")}
              </button>
              {!canSave && saveDisabledReason && (
                <div className="text-muted-foreground text-xs">{saveDisabledReason}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FlashcardGenerator({
  locale,
  sets,
  initialSelectedSetId,
}: {
  locale: AppLocale;
  sets: FlashcardSetOption[];
  initialSelectedSetId?: string;
}) {
  return (
    <LocaleProvider locale={locale}>
      <FlashcardGeneratorInner sets={sets} initialSelectedSetId={initialSelectedSetId} />
    </LocaleProvider>
  );
}
