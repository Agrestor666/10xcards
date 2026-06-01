import * as React from "react";
import { Button } from "@/components/ui/button";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { useLocale } from "@/components/i18n/useLocale";
import { dispatchDashboardSetReviewGraded } from "@/lib/dashboard-set-sync";
import type { AppLocale } from "@/lib/locale";
import { localeToBcp47 } from "@/lib/locale";
import { cn } from "@/lib/utils";

type DueResponse =
  | { ok: true; kind: "due"; card: { id: string; question: string; answer: string } }
  | { ok: true; kind: "empty"; nextDueAt: string | null }
  | { ok: false; message: string };

type GradeResponse = { ok: true; updated: { id: string; due_at: string | null } } | { ok: false; message: string };

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type Rating = "again" | "hard" | "good" | "easy";

interface DueState {
  kind: "due" | "empty";
  card: { id: string; question: string; answer: string } | null;
  nextDueAt: string | null;
}

function dueStateFromResponse(body: Extract<DueResponse, { ok: true }>): DueState {
  if (body.kind === "due") {
    return { kind: "due", card: body.card, nextDueAt: null };
  }
  return { kind: "empty", card: null, nextDueAt: body.nextDueAt };
}

const RATING_KEYS = {
  again: "review.rating.again",
  hard: "review.rating.hard",
  good: "review.rating.good",
  easy: "review.rating.easy",
} as const;

/** Same SRS semantics — red → amber → green → blue — with equal visual weight on paper. */
const gradeBtnClass = {
  again: cn(
    "border-red-200 bg-red-50 text-red-900 shadow-xs hover:bg-red-100 hover:text-red-950",
    "focus-visible:ring-red-300/50",
  ),
  hard: cn(
    "border-amber-200 bg-amber-50 text-amber-950 shadow-xs hover:bg-amber-100",
    "focus-visible:ring-amber-300/50",
  ),
  good: cn(
    "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-xs hover:bg-emerald-100 hover:text-emerald-950",
    "focus-visible:ring-emerald-300/50",
  ),
  easy: cn(
    "border-sky-200 bg-sky-50 text-sky-900 shadow-xs hover:bg-sky-100 hover:text-sky-950",
    "focus-visible:ring-sky-300/50",
  ),
} as const;

function ReviewSessionInner({ setId, setName }: { setId: string; setName: string }) {
  const { locale, t } = useLocale();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<"due" | "empty">("empty");
  const [card, setCard] = React.useState<{ id: string; question: string; answer: string } | null>(null);
  const [nextDueAt, setNextDueAt] = React.useState<string | null>(null);
  const [showAnswer, setShowAnswer] = React.useState(false);

  const dueUrl = React.useMemo(() => `/api/srs/due?setId=${encodeURIComponent(setId)}`, [setId]);
  const bcp47 = localeToBcp47(locale);

  function formatDueTime(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(bcp47);
  }

  const applyDueState = React.useCallback((state: DueState) => {
    setKind(state.kind);
    setCard(state.card);
    setNextDueAt(state.nextDueAt);
    setShowAnswer(false);
  }, []);

  const fetchDueState = React.useCallback(async (): Promise<{ state?: DueState; error?: string }> => {
    const res = await fetch(dueUrl, { method: "GET", credentials: "include" });
    const body = await parseJson<DueResponse>(res);
    if (!body || !("ok" in body)) {
      return { error: t("review.error.load") };
    }
    if (!body.ok) {
      return { error: body.message };
    }
    return { state: dueStateFromResponse(body) };
  }, [dueUrl, t]);

  const loadNext = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setShowAnswer(false);

    try {
      const result = await fetchDueState();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.state) {
        applyDueState(result.state);
      }
    } catch {
      setError(t("review.error.load"));
    } finally {
      setIsLoading(false);
    }
  }, [applyDueState, fetchDueState, t]);

  React.useEffect(() => {
    const cancelledRef = { current: false };

    void (async () => {
      try {
        const result = await fetchDueState();
        if (cancelledRef.current) return;
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.state) {
          applyDueState(result.state);
        }
      } catch {
        if (!cancelledRef.current) {
          setError(t("review.error.load"));
        }
      } finally {
        if (!cancelledRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [applyDueState, fetchDueState, t]);

  async function submitRating(rating: Rating) {
    if (!card) return;

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/srs/grade", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, cardId: card.id, rating }),
      });

      const body = await parseJson<GradeResponse>(res);
      if (!body || !("ok" in body)) {
        setError(t("review.error.grade"));
        return;
      }
      if (!body.ok) {
        setError(body.message);
        return;
      }

      dispatchDashboardSetReviewGraded({ setId, dueRemovedCount: 1 });
      await loadNext();
    } catch {
      setError(t("review.error.grade"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="border-border bg-card text-foreground rounded-2xl border p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold">{t("review.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("review.subtitle", { setName })}</p>
      </div>

      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-xl border px-4 py-3 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void loadNext();
              }}
              disabled={isLoading || isSaving}
            >
              {t("review.retry")}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="border-border bg-muted/50 text-muted-foreground mt-4 rounded-xl border px-4 py-6 text-sm">
          {t("review.loading")}
        </div>
      ) : kind === "empty" ? (
        <div className="border-border bg-muted/50 mt-4 grid gap-3 rounded-xl border px-4 py-6">
          <p className="text-foreground text-sm">{t("review.empty.title")}</p>
          {nextDueAt ? (
            <p className="text-muted-foreground text-sm">
              {t("review.empty.next_due")}{" "}
              <span className="text-foreground font-medium">{formatDueTime(nextDueAt)}</span>
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">{t("review.empty.no_upcoming")}</p>
          )}
          <a href={`/sets/${setId}`} className="text-primary text-sm transition-colors hover:underline">
            {t("review.back_to_set")}
          </a>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="border-border bg-background rounded-xl border px-4 py-5">
            <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("review.question")}
            </div>
            <div className="text-foreground mt-2 text-base whitespace-pre-wrap">{card?.question}</div>
          </div>

          {showAnswer ? (
            <div className="border-border bg-background rounded-xl border px-4 py-5">
              <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("review.answer")}
              </div>
              <div className="text-foreground mt-2 text-base whitespace-pre-wrap">{card?.answer}</div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAnswer(true);
              }}
              disabled={isSaving}
            >
              {t("review.show_answer")}
            </Button>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {(["again", "hard", "good", "easy"] as const).map((rating) => (
              <Button
                key={rating}
                type="button"
                variant="outline"
                onClick={() => {
                  void submitRating(rating);
                }}
                disabled={!showAnswer || isSaving}
                className={gradeBtnClass[rating]}
              >
                {t(RATING_KEYS[rating])}
              </Button>
            ))}
          </div>

          {isSaving && <p className="text-muted-foreground text-sm">{t("common.saving")}</p>}
        </div>
      )}
    </section>
  );
}

export function ReviewSession({ locale, setId, setName }: { locale: AppLocale; setId: string; setName: string }) {
  return (
    <LocaleProvider locale={locale}>
      <ReviewSessionInner setId={setId} setName={setName} />
    </LocaleProvider>
  );
}
