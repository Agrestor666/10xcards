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

export function SetDashboardList({ initialSets }: { initialSets: DashboardSetRow[] }) {
  const [sets, setSets] = React.useState(initialSets);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<DashboardSetRow | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const editingSet = sets.find((s) => s.id === editingId);
  const renameValidationError = editingSet ? validateSetName(editName, editingSet.name) : null;
  const canSaveRename = editingSet !== undefined && renameValidationError === null;

  function showError(message: string) {
    setErrorMessage(message);
  }

  function startEdit(set: DashboardSetRow) {
    setErrorMessage(null);
    setEditingId(set.id);
    setEditName(set.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveRename(id: string) {
    const current = sets.find((s) => s.id === id);
    if (!current) return;

    const validationError = validateSetName(editName, current.name);
    if (validationError) {
      showError(validationError);
      return;
    }

    const trimmedName = editName.trim();
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
      cancelEdit();
    } catch {
      showError("Could not rename set. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteSet(id: string) {
    setErrorMessage(null);
    setBusyId(id);

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
      setPendingDelete((prev) => (prev?.id === id ? null : prev));
      if (editingId === id) {
        cancelEdit();
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

  if (sets.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-blue-100/70">
        You don’t have any sets yet. Create your first one above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {errorMessage}
        </div>
      )}

      <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
        {sets.map((set) => {
          const isEditing = editingId === set.id;
          const isBusy = busyId === set.id;

          return (
            <li key={set.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {isEditing ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <input
                    type="text"
                    value={editName}
                    maxLength={MAX_SET_NAME_LENGTH}
                    disabled={isBusy}
                    onChange={(e) => {
                      setEditName(e.target.value);
                    }}
                    className={cn(
                      "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/20 focus:outline-none",
                    )}
                  />
                  {renameValidationError && renameValidationError !== "Name is unchanged" ? (
                    <span className="text-xs text-red-200">{renameValidationError}</span>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-w-0 flex-col">
                  <a
                    href={`/sets/${set.id}`}
                    className="font-medium text-white transition-colors hover:text-purple-200 hover:underline focus:text-purple-200 focus:underline focus:outline-none"
                  >
                    {set.name}
                  </a>
                  <span className="mt-1 text-xs text-blue-100/50">
                    {set.card_count === 0 ? "No cards" : `${set.card_count} card${set.card_count === 1 ? "" : "s"}`}
                    {" · "}
                    Updated {new Date(set.updated_at).toLocaleDateString()}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                {isEditing ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("border-white/15 bg-white/0 text-white hover:bg-white/10")}
                      disabled={isBusy || !canSaveRename}
                      onClick={() => {
                        void saveRename(set.id);
                      }}
                    >
                      {isBusy ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("border-white/15 bg-white/0 text-white hover:bg-white/10")}
                      disabled={isBusy}
                      onClick={cancelEdit}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("border-white/15 bg-white/0 text-white hover:bg-white/10")}
                      disabled={isBusy || editingId !== null}
                      onClick={() => {
                        startEdit(set);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className={cn("bg-red-500/80 hover:bg-red-500")}
                      disabled={isBusy || editingId !== null}
                      onClick={() => {
                        onDeleteClick(set);
                      }}
                    >
                      {isBusy ? "Deleting…" : "Delete"}
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this set?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong className="text-white">
                {pendingDelete?.card_count ?? 0} flashcard{(pendingDelete?.card_count ?? 0) === 1 ? "" : "s"}
              </strong>{" "}
              and the set <strong className="text-white">{pendingDelete?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === pendingDelete?.id}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyId === pendingDelete?.id}
              className={cn("bg-red-500/80 hover:bg-red-500")}
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
