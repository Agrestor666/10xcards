import * as React from "react";
import { MoreHorizontal } from "lucide-react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NewSetDialog } from "@/components/dashboard/NewSetDialog";
import {
  DASHBOARD_SET_CARDS_ADDED,
  DASHBOARD_SET_REVIEW_GRADED,
  dispatchDashboardSetDeleted,
  fetchDashboardDueSummary,
  type DashboardSetCardsAddedDetail,
  type DashboardSetReviewGradedDetail,
} from "@/lib/dashboard-set-sync";
import { cn } from "@/lib/utils";
import type { DashboardSetRow } from "@/types";

const MAX_SET_NAME_LENGTH = 80;

type UpdateResponse =
  | { ok: true; set: Pick<DashboardSetRow, "id" | "name" | "created_at" | "updated_at"> }
  | { ok: false; message: string };

type DeleteResponse = { ok: true } | { ok: false; message: string };

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function validateSetName(name: string, originalName: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1) {
    return "Set name cannot be empty";
  }
  if (trimmed.length > MAX_SET_NAME_LENGTH) {
    return `Set name must be at most ${MAX_SET_NAME_LENGTH} characters`;
  }
  if (trimmed === originalName.trim()) {
    return "Name is unchanged";
  }
  return null;
}

function SetTileMenu({
  set,
  disabled,
  onRename,
  onDelete,
}: {
  set: DashboardSetRow;
  disabled: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" disabled={disabled} aria-label={`Actions for ${set.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuItem
          onSelect={() => {
            onRename();
          }}
        >
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => {
            onDelete();
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SetDashboardGrid({ initialSets }: { initialSets: DashboardSetRow[] }) {
  const [sets, setSets] = React.useState(initialSets);
  const [renameTarget, setRenameTarget] = React.useState<DashboardSetRow | null>(null);
  const [editName, setEditName] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<DashboardSetRow | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const renameValidationError = renameTarget ? validateSetName(editName, renameTarget.name) : null;
  const canSaveRename = renameTarget !== null && renameValidationError === null;

  React.useEffect(() => {
    function onCardsAdded(event: Event) {
      const detail = (event as CustomEvent<DashboardSetCardsAddedDetail>).detail;
      const dueDelta = detail.dueAddedCount ?? detail.addedCount;
      setSets((prev) =>
        prev.map((s) =>
          s.id === detail.setId
            ? {
                ...s,
                card_count: s.card_count + detail.addedCount,
                due_count: s.due_count + dueDelta,
                updated_at: new Date().toISOString(),
              }
            : s,
        ),
      );
    }

    function onReviewGraded(event: Event) {
      const detail = (event as CustomEvent<DashboardSetReviewGradedDetail>).detail;
      const delta = detail.dueRemovedCount ?? 1;
      setSets((prev) =>
        prev.map((s) => (s.id === detail.setId ? { ...s, due_count: Math.max(0, s.due_count - delta) } : s)),
      );
    }

    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      void fetchDashboardDueSummary().then((summary) => {
        if (!summary) return;
        setSets((prev) =>
          prev.map((s) => ({
            ...s,
            due_count: summary.dueBySetId[s.id] ?? 0,
          })),
        );
      });
    }

    window.addEventListener(DASHBOARD_SET_CARDS_ADDED, onCardsAdded);
    window.addEventListener(DASHBOARD_SET_REVIEW_GRADED, onReviewGraded);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener(DASHBOARD_SET_CARDS_ADDED, onCardsAdded);
      window.removeEventListener(DASHBOARD_SET_REVIEW_GRADED, onReviewGraded);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  function showError(message: string) {
    setErrorMessage(message);
  }

  function openRename(set: DashboardSetRow) {
    setErrorMessage(null);
    setRenameTarget(set);
    setEditName(set.name);
  }

  function closeRename() {
    setRenameTarget(null);
    setEditName("");
  }

  async function saveRename() {
    if (!renameTarget) return;

    const validationError = validateSetName(editName, renameTarget.name);
    if (validationError) {
      showError(validationError);
      return;
    }

    const trimmedName = editName.trim();
    const id = renameTarget.id;
    setErrorMessage(null);
    setBusyId(id);

    try {
      const res = await fetch("/api/flashcard-sets/update", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: trimmedName }),
      });

      const body = await parseJson<UpdateResponse>(res);
      if (!body || !("ok" in body)) {
        showError("Could not rename set. Please try again.");
        return;
      }
      if (!body.ok) {
        showError(body.message);
        return;
      }

      setSets((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                name: body.set.name,
                updated_at: body.set.updated_at,
              }
            : s,
        ),
      );
      closeRename();
    } catch {
      showError("Could not rename set. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteSet(id: string) {
    setErrorMessage(null);
    setBusyId(id);
    const deletedSet = sets.find((s) => s.id === id);

    try {
      const res = await fetch("/api/flashcard-sets/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const body = await parseJson<DeleteResponse>(res);
      if (!body || !("ok" in body)) {
        showError("Could not delete set. Please try again.");
        return;
      }
      if (!body.ok) {
        showError(body.message);
        return;
      }

      setSets((prev) => prev.filter((s) => s.id !== id));
      if (deletedSet) {
        dispatchDashboardSetDeleted({ setId: id, dueCount: deletedSet.due_count });
      }
      setPendingDelete((prev) => (prev?.id === id ? null : prev));
      if (renameTarget?.id === id) {
        closeRename();
      }
    } catch {
      showError("Could not delete set. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  function onDeleteClick(set: DashboardSetRow) {
    setErrorMessage(null);
    if (set.card_count === 0) {
      void deleteSet(set.id);
      return;
    }
    setPendingDelete(set);
  }

  const menuDisabled = busyId !== null;

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sets.map((set) => {
          const isBusy = busyId === set.id;
          const cardLabel =
            set.card_count === 0 ? "0 cards" : `${set.card_count} card${set.card_count === 1 ? "" : "s"}`;
          const dueLabel = `${set.due_count} due`;

          return (
            <article
              key={set.id}
              className={cn("border-border bg-card flex flex-col gap-4 rounded-xl border p-5 shadow-sm")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <a
                    href={`/sets/${set.id}`}
                    className="text-foreground hover:text-primary font-medium transition-colors hover:underline"
                  >
                    {set.name}
                  </a>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {cardLabel} · {dueLabel}
                  </p>
                </div>
                <SetTileMenu
                  set={set}
                  disabled={menuDisabled || isBusy}
                  onRename={() => {
                    openRename(set);
                  }}
                  onDelete={() => {
                    onDeleteClick(set);
                  }}
                />
              </div>
              <Button asChild className="w-full sm:w-auto" disabled={isBusy}>
                <a href={`/sets/${set.id}/review`}>Study</a>
              </Button>
            </article>
          );
        })}
        <NewSetDialog />
      </div>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeRename();
          }
        }}
      >
        {renameTarget ? (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rename set</DialogTitle>
            </DialogHeader>
            <Input
              type="text"
              value={editName}
              maxLength={MAX_SET_NAME_LENGTH}
              disabled={busyId === renameTarget.id}
              onChange={(e) => {
                setEditName(e.target.value);
              }}
              className={cn("border-border bg-background text-foreground")}
            />
            {renameValidationError && renameValidationError !== "Name is unchanged" ? (
              <span className="text-destructive text-xs">{renameValidationError}</span>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeRename} disabled={busyId === renameTarget.id}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canSaveRename || busyId === renameTarget.id}
                onClick={() => {
                  void saveRename();
                }}
              >
                {busyId === renameTarget.id ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent className={cn("border-border bg-card text-foreground")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete this set?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete{" "}
              <strong className="text-foreground">
                {pendingDelete?.card_count ?? 0} flashcard{(pendingDelete?.card_count ?? 0) === 1 ? "" : "s"}
              </strong>{" "}
              and the set <strong className="text-foreground">{pendingDelete?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === pendingDelete?.id}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyId === pendingDelete?.id}
              className={cn("bg-destructive hover:bg-destructive/90")}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) {
                  void deleteSet(pendingDelete.id);
                }
              }}
            >
              {busyId === pendingDelete?.id ? "Deleting…" : "Delete set"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
