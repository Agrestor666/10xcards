import { useEffect, useMemo, useRef, useState } from "react";
import { FlashcardRow } from "@/components/flashcards/FlashcardRow";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { useLocale } from "@/components/i18n/useLocale";
import {
  MAX_CARD_FIELD_CHARS,
  MAX_CARDS_PER_REQUEST,
  MAX_SOURCE_TEXT_CHARS,
  MAX_TOPIC_CHARS,
} from "@/lib/ai-generation-limits";
import {
  DASHBOARD_SET_CREATED,
  DASHBOARD_SET_DELETED,
  DASHBOARD_SET_UPDATED,
  dispatchDashboardSetCardsAdded,
  dispatchDashboardSetCreated,
  type DashboardSetCreatedDetail,
  type DashboardSetDeletedDetail,
  type DashboardSetUpdatedDetail,
} from "@/lib/dashboard-set-sync";
import { flashcardSetErrorMessage } from "@/lib/flashcard-set-errors";
import { FLASHCARD_SET_NAME_MAX_LENGTH, validateFlashcardSetName } from "@/lib/flashcard-set-name";
import type { MessageKey } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

const NEW_SET_OPTION_VALUE = "__new__";

const paperFieldClass =
  "border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none";

interface FlashcardSetOption {
  id: string;
  name: string;
}

interface FlashcardDraft {
  id: string;
  question: string;
  answer: string;
}

interface CreatedFlashcardSet {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

type GeneratorMode = "text" | "topic";

type SaveStatus = "idle" | "saving" | "success" | "error";

type GenerateResponse =
  | { ok: true; cards: { question: string; answer: string }[] }
  | { ok: false; errorKey?: string; message?: string };

type BulkCreateResponse = { ok: true; insertedCount: number } | { ok: false; message: string };

type CreateSetResponse = { ok: true; set: CreatedFlashcardSet } | { ok: false; message?: string };

function createDraftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `draft_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function initialSelectedSetId(sets: FlashcardSetOption[], preferredId?: string): string {
  if (preferredId) return preferredId;
  if (sets.length === 0) return NEW_SET_OPTION_VALUE;
  return sets[0]?.id ?? NEW_SET_OPTION_VALUE;
}

function topicSetNamePrefill(topic: string): string {
  return topic.trim().slice(0, FLASHCARD_SET_NAME_MAX_LENGTH);
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
  initialSelectedSetId: preferredSetId,
}: {
  sets: FlashcardSetOption[];
  initialSelectedSetId?: string;
}) {
  const { locale, t } = useLocale();

  const [mode, setMode] = useState<GeneratorMode>("text");
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [cardsDraft, setCardsDraft] = useState<FlashcardDraft[]>([]);
  const [availableSets, setAvailableSets] = useState(sets);
  const [selectedSetId, setSelectedSetId] = useState(() => initialSelectedSetId(sets, preferredSetId));
  const [newSetName, setNewSetName] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const newSetNameTouchedRef = useRef(false);
  const availableSetsRef = useRef(availableSets);

  useEffect(() => {
    availableSetsRef.current = availableSets;
  }, [availableSets]);

  useEffect(() => {
    function onSetCreated(event: Event) {
      const detail = (event as CustomEvent<DashboardSetCreatedDetail>).detail;
      const row = { id: detail.set.id, name: detail.set.name };
      setAvailableSets((prev) => (prev.some((set) => set.id === row.id) ? prev : [row, ...prev]));
    }

    function onSetUpdated(event: Event) {
      const detail = (event as CustomEvent<DashboardSetUpdatedDetail>).detail;
      setAvailableSets((prev) => prev.map((set) => (set.id === detail.id ? { ...set, name: detail.name } : set)));
    }

    function onSetDeleted(event: Event) {
      const detail = (event as CustomEvent<DashboardSetDeletedDetail>).detail;
      const remaining = availableSetsRef.current.filter((set) => set.id !== detail.setId);
      setAvailableSets(remaining);
      setSelectedSetId((current) => {
        if (current !== detail.setId) return current;
        return remaining.length === 0 ? NEW_SET_OPTION_VALUE : "";
      });
    }

    window.addEventListener(DASHBOARD_SET_CREATED, onSetCreated);
    window.addEventListener(DASHBOARD_SET_UPDATED, onSetUpdated);
    window.addEventListener(DASHBOARD_SET_DELETED, onSetDeleted);
    return () => {
      window.removeEventListener(DASHBOARD_SET_CREATED, onSetCreated);
      window.removeEventListener(DASHBOARD_SET_UPDATED, onSetUpdated);
      window.removeEventListener(DASHBOARD_SET_DELETED, onSetDeleted);
    };
  }, []);

  const textTrimmed = text.trim();
  const topicTrimmed = topic.trim();
  const canGenerate =
    !isGenerating && saveStatus !== "saving" && (mode === "text" ? textTrimmed.length > 0 : topicTrimmed.length > 0);
  const canSave = !isGenerating && saveStatus !== "saving" && cardsDraft.length > 0 && Boolean(selectedSetId);

  const saveDisabledReason = useMemo(() => {
    if (saveStatus === "saving") return t("common.saving");
    if (!selectedSetId) return t("generator.error.choose_set");
    if (cardsDraft.length === 0) return t("generator.error.add_card");
    return null;
  }, [cardsDraft.length, saveStatus, selectedSetId, t]);

  function selectMode(next: GeneratorMode) {
    setMode(next);
    setErrorMessage(null);
  }

  function onSelectedSetChange(next: string) {
    setSelectedSetId(next);
    if (next === NEW_SET_OPTION_VALUE && mode === "topic" && newSetName.trim() === "") {
      const prefill = topicSetNamePrefill(topic);
      if (prefill) {
        newSetNameTouchedRef.current = false;
        setNewSetName(prefill);
      }
    }
  }

  async function onGenerate() {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (saveStatus !== "saving") {
      setSaveStatus("idle");
    }

    if (mode === "topic") {
      const trimmed = topic.trim();
      if (!trimmed) {
        setErrorMessage(t("generator.error.enter_topic"));
        return;
      }
      if (trimmed.length > MAX_TOPIC_CHARS) {
        setErrorMessage(t("generator.error.topic_max", { max: MAX_TOPIC_CHARS }));
        return;
      }
      await requestDrafts({ mode: "topic", topic: trimmed });
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMessage(t("generator.error.paste_text"));
      return;
    }
    if (trimmed.length > MAX_SOURCE_TEXT_CHARS) {
      setErrorMessage(t("generator.error.text_max", { max: MAX_SOURCE_TEXT_CHARS }));
      return;
    }
    await requestDrafts({ mode: "text", text: trimmed });
  }

  async function requestDrafts(body: { mode: "text"; text: string } | { mode: "topic"; topic: string }) {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await parseJson<GenerateResponse>(res);

      if (!payload || !("ok" in payload)) {
        setErrorMessage(t("generator.error.generate"));
        return;
      }

      if (!payload.ok) {
        if (payload.message) {
          setErrorMessage(payload.message);
        } else if (payload.errorKey) {
          setErrorMessage(t(payload.errorKey as MessageKey));
        } else {
          setErrorMessage(t("generator.error.generate"));
        }
        return;
      }

      const drafts = payload.cards.slice(0, MAX_CARDS_PER_REQUEST).map((card) => ({
        id: createDraftId(),
        question: card.question,
        answer: card.answer,
      }));

      setCardsDraft(drafts);
      if (drafts.length === 0) {
        setErrorMessage(t("generator.error.no_cards"));
      }

      if (body.mode === "topic" && selectedSetId === NEW_SET_OPTION_VALUE && !newSetNameTouchedRef.current) {
        setNewSetName(topicSetNamePrefill(body.topic));
      }
    } catch {
      setErrorMessage(t("generator.error.generate"));
    } finally {
      setIsGenerating(false);
    }
  }

  function updateDraft(id: string, patch: Partial<Pick<FlashcardDraft, "question" | "answer">>) {
    setCardsDraft((prev) => prev.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  }

  function deleteDraft(id: string) {
    setCardsDraft((prev) => prev.filter((card) => card.id !== id));
  }

  function rememberCreatedSet(created: CreatedFlashcardSet) {
    const row = { id: created.id, name: created.name };
    setAvailableSets((prev) => (prev.some((set) => set.id === row.id) ? prev : [row, ...prev]));
    setSelectedSetId(created.id);
    setNewSetName("");
    newSetNameTouchedRef.current = false;
    dispatchDashboardSetCreated({
      set: {
        ...created,
        card_count: 0,
        due_count: 0,
      },
    });
  }

  async function onSave() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSaveStatus("idle");

    if (cardsDraft.length === 0) {
      setErrorMessage(t("generator.error.add_card"));
      return;
    }

    let targetSetId = selectedSetId;
    let targetSetName = availableSets.find((set) => set.id === selectedSetId)?.name;
    const creatingSet = selectedSetId === NEW_SET_OPTION_VALUE;

    if (creatingSet) {
      const validation = validateFlashcardSetName(newSetName);
      if (!validation.ok) {
        setErrorMessage(flashcardSetErrorMessage(locale, validation.key));
        return;
      }
      targetSetName = validation.name;
    } else if (!selectedSetId) {
      setErrorMessage(t("generator.error.choose_set"));
      return;
    }

    setSaveStatus("saving");
    let savePhase: "create" | "save" = creatingSet ? "create" : "save";

    try {
      if (creatingSet) {
        const res = await fetch("/api/flashcard-sets/create", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: targetSetName }),
        });

        const body = await parseJson<CreateSetResponse>(res);
        if (!body?.ok) {
          setSaveStatus("error");
          setErrorMessage(body?.message ?? t("sets.error.create_failed"));
          return;
        }

        rememberCreatedSet(body.set);
        targetSetId = body.set.id;
        targetSetName = body.set.name;
        savePhase = "save";
      }

      const payloadCards = cardsDraft.slice(0, MAX_CARDS_PER_REQUEST).map((card) => ({
        question: card.question,
        answer: card.answer,
      }));

      const res = await fetch("/api/flashcards/bulk-create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: targetSetId, cards: payloadCards }),
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

      const setName = targetSetName ?? t("generator.your_set");
      setSaveStatus("success");
      setSuccessMessage(t("generator.success.saved", { count: body.insertedCount, setName }));
      dispatchDashboardSetCardsAdded({
        setId: targetSetId,
        addedCount: body.insertedCount,
        dueAddedCount: body.insertedCount,
      });
      if (mode === "text") {
        setText("");
      } else {
        setTopic("");
      }
      setCardsDraft([]);
    } catch {
      setSaveStatus("error");
      setErrorMessage(savePhase === "create" ? t("sets.error.create_failed") : t("generator.error.save"));
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
        <div role="group" className="border-border bg-muted inline-flex w-fit rounded-lg border p-1">
          <button
            type="button"
            aria-pressed={mode === "text"}
            onClick={() => {
              selectMode("text");
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "text"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("generator.mode.text")}
          </button>
          <button
            type="button"
            aria-pressed={mode === "topic"}
            onClick={() => {
              selectMode("topic");
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "topic"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("generator.mode.topic")}
          </button>
        </div>

        {mode === "text" ? (
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
              onChange={(event) => {
                setText(event.target.value);
              }}
              rows={6}
              placeholder={t("generator.placeholder")}
              className={cn(paperFieldClass, "resize-y")}
            />
          </div>
        ) : (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="generator-topic" className="text-sm font-medium">
                {t("generator.topic.label")}
              </label>
              <span
                className={cn(
                  "text-muted-foreground font-mono text-xs",
                  topicTrimmed.length > MAX_TOPIC_CHARS && "text-destructive",
                )}
              >
                {topicTrimmed.length}/{MAX_TOPIC_CHARS}
              </span>
            </div>
            <input
              id="generator-topic"
              type="text"
              value={topic}
              maxLength={MAX_TOPIC_CHARS}
              aria-label={t("generator.topic.label")}
              placeholder={t("generator.topic.placeholder")}
              onChange={(event) => {
                setTopic(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing && canGenerate) {
                  event.preventDefault();
                  void onGenerate();
                }
              }}
              className={paperFieldClass}
            />
            <p className="text-muted-foreground text-xs">{t("generator.topic.hint")}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <button
            type="button"
            onClick={() => {
              void onGenerate();
            }}
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

          <div className="flex w-full flex-col gap-2 sm:w-[260px] sm:items-stretch">
            <label className="text-muted-foreground text-xs" htmlFor="generator-target-set">
              {t("generator.save_to_set")}
            </label>
            <select
              id="generator-target-set"
              value={selectedSetId}
              onChange={(event) => {
                onSelectedSetChange(event.target.value);
              }}
              className="border-border bg-background text-foreground focus:border-ring focus:ring-ring/30 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            >
              <option value="">{t("generator.choose_set_option")}</option>
              {availableSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
              <option value={NEW_SET_OPTION_VALUE}>{t("generator.new_set_option")}</option>
            </select>
            {selectedSetId === NEW_SET_OPTION_VALUE && (
              <div className="grid gap-1">
                <label htmlFor="generator-new-set-name" className="text-muted-foreground text-xs">
                  {t("generator.new_set_name.label")}
                </label>
                <input
                  id="generator-new-set-name"
                  type="text"
                  value={newSetName}
                  maxLength={FLASHCARD_SET_NAME_MAX_LENGTH}
                  placeholder={t("generator.new_set_name.placeholder")}
                  onChange={(event) => {
                    newSetNameTouchedRef.current = true;
                    setNewSetName(event.target.value);
                  }}
                  className={paperFieldClass}
                />
              </div>
            )}
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
              {cardsDraft.map((card) => (
                <li key={card.id}>
                  <FlashcardRow
                    mode="draft"
                    question={card.question}
                    answer={card.answer}
                    onQuestionChange={(next) => {
                      updateDraft(card.id, { question: next });
                    }}
                    onAnswerChange={(next) => {
                      updateDraft(card.id, { answer: next });
                    }}
                    onRemove={() => {
                      deleteDraft(card.id);
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
                onClick={() => {
                  void onSave();
                }}
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
