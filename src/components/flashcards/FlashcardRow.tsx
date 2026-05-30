import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UiTheme } from "@/types";

export type FlashcardRowMode = "persisted" | "draft";

interface BaseProps {
  mode: FlashcardRowMode;
  question: string;
  answer: string;
  onQuestionChange: (next: string) => void;
  onAnswerChange: (next: string) => void;
  maxChars?: number;
}

interface PersistedProps extends BaseProps {
  mode: "persisted";
  onSave: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  saveError?: string;
}

interface DraftProps extends BaseProps {
  mode: "draft";
  onRemove: () => void;
}

/** @deprecated Use `UiTheme` from `@/types`. */
export type FlashcardRowTheme = UiTheme;

export type FlashcardRowProps = (PersistedProps | DraftProps) & {
  /** `paper` for all user-facing study surfaces; cosmic branch retained until Phase 4 grep. */
  theme?: UiTheme;
};

export function FlashcardRow(props: FlashcardRowProps) {
  const { question, answer, onQuestionChange, onAnswerChange, maxChars = 2000, theme = "paper" } = props;
  const [isDeleteConfirming, setIsDeleteConfirming] = React.useState(false);
  const isPaper = theme === "paper";

  const shellClass = isPaper
    ? "border-border bg-card rounded-xl border p-4 shadow-sm"
    : "rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl";

  const labelClass = isPaper ? "text-muted-foreground text-xs font-medium" : "text-xs font-medium text-blue-100/70";

  const fieldClass = isPaper
    ? "border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 w-full resize-y rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
    : "w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/20 focus:outline-none";

  const counterClass = isPaper ? "text-muted-foreground text-[11px]" : "text-[11px] text-blue-100/50";

  const cosmicOutlineBtn = cn("border-white/15 bg-white/0 text-white hover:bg-white/10");
  const cosmicDestructiveBtn = cn("bg-red-500/80 hover:bg-red-500");

  return (
    <div className={shellClass}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={labelClass}>Question</span>
          <textarea
            value={question}
            onChange={(e) => {
              onQuestionChange(e.target.value);
            }}
            rows={3}
            maxLength={maxChars}
            className={fieldClass}
          />
          <span className={counterClass}>
            {question.length}/{maxChars}
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className={labelClass}>Answer</span>
          <textarea
            value={answer}
            onChange={(e) => {
              onAnswerChange(e.target.value);
            }}
            rows={3}
            maxLength={maxChars}
            className={fieldClass}
          />
          <span className={counterClass}>
            {answer.length}/{maxChars}
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-[18px] text-xs">
          {props.mode === "persisted" && props.saveError ? (
            <span className={isPaper ? "text-destructive" : "text-red-200"}>{props.saveError}</span>
          ) : (
            <span className={isPaper ? "text-muted-foreground" : "text-blue-100/50"} />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {props.mode === "draft" ? (
            <Button
              type="button"
              variant="outline"
              className={isPaper ? undefined : cosmicOutlineBtn}
              onClick={() => {
                props.onRemove();
              }}
            >
              Remove
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className={isPaper ? undefined : cosmicOutlineBtn}
                onClick={() => {
                  props.onSave();
                }}
                disabled={props.isSaving || props.isDeleting}
              >
                {props.isSaving ? "Saving…" : "Save"}
              </Button>

              {!isDeleteConfirming ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setIsDeleteConfirming(true);
                  }}
                  disabled={props.isSaving || props.isDeleting}
                  className={isPaper ? undefined : cosmicDestructiveBtn}
                >
                  Delete
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setIsDeleteConfirming(false);
                      props.onDelete();
                    }}
                    disabled={props.isSaving || props.isDeleting}
                    className={isPaper ? undefined : cosmicDestructiveBtn}
                  >
                    {props.isDeleting ? "Deleting…" : "Confirm delete"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={isPaper ? undefined : cosmicOutlineBtn}
                    onClick={() => {
                      setIsDeleteConfirming(false);
                    }}
                    disabled={props.isSaving || props.isDeleting}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
