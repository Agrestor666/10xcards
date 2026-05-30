import * as React from "react";
import { Button } from "@/components/ui/button";
import { dispatchDashboardSetReviewGraded } from "@/lib/dashboard-set-sync";
import { cn } from "@/lib/utils";
import type { UiTheme } from "@/types";

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

function formatDueTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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

async function fetchDueState(dueUrl: string): Promise<{ state?: DueState; error?: string }> {
  const res = await fetch(dueUrl, { method: "GET", credentials: "include" });
  const body = await parseJson<DueResponse>(res);
  if (!body || !("ok" in body)) {
    return { error: "Could not load your next card. Please try again." };
  }
  if (!body.ok) {
    return { error: body.message };
  }
  return { state: dueStateFromResponse(body) };
}

interface ReviewSessionProps {
  setId: string;
  setName: string;
  theme?: UiTheme;
}

export function ReviewSession({ setId, setName, theme = "paper" }: ReviewSessionProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<"due" | "empty">("empty");
  const [card, setCard] = React.useState<{ id: string; question: string; answer: string } | null>(null);
  const [nextDueAt, setNextDueAt] = React.useState<string | null>(null);
  const [showAnswer, setShowAnswer] = React.useState(false);

  const isPaper = theme === "paper";
  const dueUrl = React.useMemo(() => `/api/srs/due?setId=${encodeURIComponent(setId)}`, [setId]);

  const sectionClass = isPaper
    ? "border-border bg-card text-foreground rounded-2xl border p-6 shadow-sm"
    : "rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl";

  const subtitleClass = isPaper ? "text-muted-foreground text-sm" : "text-sm text-blue-100/70";

  const errorClass = isPaper
    ? "border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-xl border px-4 py-3 text-sm"
    : "mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100";

  const retryBtnClass = isPaper ? undefined : cn("bg-white/10 text-white hover:bg-white/15");

  const loadingClass = isPaper
    ? "border-border bg-muted/50 text-muted-foreground mt-4 rounded-xl border px-4 py-6 text-sm"
    : "mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-blue-100/70";

  const emptyShellClass = isPaper
    ? "border-border bg-muted/50 mt-4 grid gap-3 rounded-xl border px-4 py-6"
    : "mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-6";

  const emptyTextClass = isPaper ? "text-foreground text-sm" : "text-sm text-blue-100/80";

  const emptyMutedClass = isPaper ? "text-muted-foreground text-sm" : "text-sm text-blue-100/70";

  const emptyStrongClass = isPaper ? "text-foreground font-medium" : "font-medium text-white";

  const backLinkClass = isPaper
    ? "text-primary text-sm transition-colors hover:underline"
    : "text-sm text-purple-300 transition-colors hover:text-purple-100 hover:underline";

  const cardShellClass = isPaper
    ? "border-border bg-background rounded-xl border px-4 py-5"
    : "rounded-xl border border-white/10 bg-white/5 px-4 py-5";

  const cardLabelClass = isPaper
    ? "text-muted-foreground text-xs font-medium tracking-wide uppercase"
    : "text-xs font-medium tracking-wide text-blue-100/60 uppercase";

  const cardTextClass = isPaper
    ? "text-foreground mt-2 text-base whitespace-pre-wrap"
    : "mt-2 text-base whitespace-pre-wrap text-white";

  const showAnswerBtnClass = isPaper ? undefined : cn("bg-white/10 text-white hover:bg-white/15");

  const savingClass = isPaper ? "text-muted-foreground text-sm" : "text-sm text-blue-100/70";

  const cosmicGradeBtn = {
    again: cn("bg-red-500/40 text-white hover:bg-red-500/50"),
    hard: cn("bg-amber-500/40 text-white hover:bg-amber-500/50"),
    good: cn("bg-emerald-500/40 text-white hover:bg-emerald-500/50"),
    easy: cn("bg-sky-500/40 text-white hover:bg-sky-500/50"),
  } as const;

  /** Same SRS semantics as cosmic — red → amber → green → blue — with equal visual weight on paper. */
  const paperGradeBtn = {
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

  const applyDueState = React.useCallback((state: DueState) => {
    setKind(state.kind);
    setCard(state.card);
    setNextDueAt(state.nextDueAt);
    setShowAnswer(false);
  }, []);

  const loadNext = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setShowAnswer(false);

    try {
      const result = await fetchDueState(dueUrl);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.state) {
        applyDueState(result.state);
      }
    } catch {
      setError("Could not load your next card. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [applyDueState, dueUrl]);

  React.useEffect(() => {
    const cancelledRef = { current: false };

    void (async () => {
      try {
        const result = await fetchDueState(dueUrl);
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
          setError("Could not load your next card. Please try again.");
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
  }, [applyDueState, dueUrl]);

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
        setError("Could not save your rating. Please try again.");
        return;
      }
      if (!body.ok) {
        setError(body.message);
        return;
      }

      dispatchDashboardSetReviewGraded({ setId, dueRemovedCount: 1 });
      await loadNext();
    } catch {
      setError("Could not save your rating. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function gradeButtonProps(rating: Rating): {
    variant: "outline" | "secondary";
    className?: string;
  } {
    if (!isPaper) {
      return { variant: "secondary", className: cosmicGradeBtn[rating] };
    }
    return { variant: "outline", className: paperGradeBtn[rating] };
  }

  return (
    <section className={sectionClass}>
      <div className="flex flex-col gap-1">
        <h2 className={cn("text-lg font-semibold", isPaper ? "text-foreground" : "text-white")}>Review</h2>
        <p className={subtitleClass}>You are reviewing cards in {setName}.</p>
      </div>

      {error && (
        <div className={errorClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void loadNext();
              }}
              disabled={isLoading || isSaving}
              className={retryBtnClass}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className={loadingClass}>Loading your next card…</div>
      ) : kind === "empty" ? (
        <div className={emptyShellClass}>
          <p className={emptyTextClass}>No cards due right now.</p>
          {nextDueAt ? (
            <p className={emptyMutedClass}>
              Next card due: <span className={emptyStrongClass}>{formatDueTime(nextDueAt)}</span>
            </p>
          ) : (
            <p className={emptyMutedClass}>No upcoming cards scheduled yet.</p>
          )}
          <a href={`/sets/${setId}`} className={backLinkClass}>
            ← Back to set
          </a>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className={cardShellClass}>
            <div className={cardLabelClass}>Question</div>
            <div className={cardTextClass}>{card?.question}</div>
          </div>

          {showAnswer ? (
            <div className={cardShellClass}>
              <div className={cardLabelClass}>Answer</div>
              <div className={cardTextClass}>{card?.answer}</div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAnswer(true);
              }}
              disabled={isSaving}
              className={showAnswerBtnClass}
            >
              Show answer
            </Button>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {(["again", "hard", "good", "easy"] as const).map((rating) => {
              const { variant, className } = gradeButtonProps(rating);
              return (
                <Button
                  key={rating}
                  type="button"
                  variant={variant}
                  onClick={() => {
                    void submitRating(rating);
                  }}
                  disabled={!showAnswer || isSaving}
                  className={className}
                >
                  {rating.charAt(0).toUpperCase() + rating.slice(1)}
                </Button>
              );
            })}
          </div>

          {isSaving && <p className={savingClass}>Saving…</p>}
        </div>
      )}
    </section>
  );
}
