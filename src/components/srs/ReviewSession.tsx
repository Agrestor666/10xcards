import * as React from "react";
import { Button } from "@/components/ui/button";
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

export function ReviewSession({ setId, setName }: { setId: string; setName: string }) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<"due" | "empty">("empty");
  const [card, setCard] = React.useState<{ id: string; question: string; answer: string } | null>(null);
  const [nextDueAt, setNextDueAt] = React.useState<string | null>(null);
  const [showAnswer, setShowAnswer] = React.useState(false);

  const dueUrl = React.useMemo(() => `/api/srs/due?setId=${encodeURIComponent(setId)}`, [setId]);

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
        body: JSON.stringify({ cardId: card.id, rating }),
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

      await loadNext();
    } catch {
      setError("Could not save your rating. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-white">Review</h2>
        <p className="text-sm text-blue-100/70">You are reviewing cards in {setName}.</p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void loadNext();
              }}
              disabled={isLoading || isSaving}
              className={cn("bg-white/10 text-white hover:bg-white/15")}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-blue-100/70">
          Loading your next card…
        </div>
      ) : kind === "empty" ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-6">
          <p className="text-sm text-blue-100/80">No cards due right now.</p>
          {nextDueAt ? (
            <p className="text-sm text-blue-100/70">
              Next card due: <span className="font-medium text-white">{formatDueTime(nextDueAt)}</span>
            </p>
          ) : (
            <p className="text-sm text-blue-100/70">No upcoming cards scheduled yet.</p>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-5">
            <div className="text-xs font-medium tracking-wide text-blue-100/60 uppercase">Question</div>
            <div className="mt-2 text-base whitespace-pre-wrap text-white">{card?.question}</div>
          </div>

          {showAnswer ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-5">
              <div className="text-xs font-medium tracking-wide text-blue-100/60 uppercase">Answer</div>
              <div className="mt-2 text-base whitespace-pre-wrap text-white">{card?.answer}</div>
            </div>
          ) : (
            <Button
              type="button"
              onClick={() => {
                setShowAnswer(true);
              }}
              disabled={isSaving}
              className={cn("bg-white/10 text-white hover:bg-white/15")}
            >
              Show answer
            </Button>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              onClick={() => {
                void submitRating("again");
              }}
              disabled={!showAnswer || isSaving}
              className={cn("bg-red-500/40 text-white hover:bg-red-500/50")}
            >
              Again
            </Button>
            <Button
              type="button"
              onClick={() => {
                void submitRating("hard");
              }}
              disabled={!showAnswer || isSaving}
              className={cn("bg-amber-500/40 text-white hover:bg-amber-500/50")}
            >
              Hard
            </Button>
            <Button
              type="button"
              onClick={() => {
                void submitRating("good");
              }}
              disabled={!showAnswer || isSaving}
              className={cn("bg-emerald-500/40 text-white hover:bg-emerald-500/50")}
            >
              Good
            </Button>
            <Button
              type="button"
              onClick={() => {
                void submitRating("easy");
              }}
              disabled={!showAnswer || isSaving}
              className={cn("bg-sky-500/40 text-white hover:bg-sky-500/50")}
            >
              Easy
            </Button>
          </div>

          {isSaving && <p className="text-sm text-blue-100/70">Saving…</p>}
        </div>
      )}
    </section>
  );
}
