import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export type FlashcardRowProps = PersistedProps | DraftProps;

export function FlashcardRow(props: FlashcardRowProps) {
  const { question, answer, onQuestionChange, onAnswerChange, maxChars = 2000 } = props;
  const [isDeleteConfirming, setIsDeleteConfirming] = React.useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium text-blue-100/70">Question</span>
          <textarea
            value={question}
            onChange={(e) => {
              onQuestionChange(e.target.value);
            }}
            rows={3}
            maxLength={maxChars}
            className={cn(
              "w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/20 focus:outline-none",
            )}
          />
          <span className="text-[11px] text-blue-100/50">
            {question.length}/{maxChars}
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium text-blue-100/70">Answer</span>
          <textarea
            value={answer}
            onChange={(e) => {
              onAnswerChange(e.target.value);
            }}
            rows={3}
            maxLength={maxChars}
            className={cn(
              "w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/20 focus:outline-none",
            )}
          />
          <span className="text-[11px] text-blue-100/50">
            {answer.length}/{maxChars}
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-[18px] text-xs">
          {props.mode === "persisted" && props.saveError ? (
            <span className="text-red-200">{props.saveError}</span>
          ) : (
            <span className="text-blue-100/50" />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {props.mode === "draft" ? (
            <Button
              type="button"
              variant="outline"
              className={cn("border-white/15 bg-white/0 text-white hover:bg-white/10")}
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
                className={cn("border-white/15 bg-white/0 text-white hover:bg-white/10")}
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
                  className={cn("bg-red-500/80 hover:bg-red-500")}
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
                    className={cn("bg-red-500/80 hover:bg-red-500")}
                  >
                    {props.isDeleting ? "Deleting…" : "Confirm delete"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("border-white/15 bg-white/0 text-white hover:bg-white/10")}
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
