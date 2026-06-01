import * as React from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/i18n/useLocale";

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
  const { t } = useLocale();
  const { question, answer, onQuestionChange, onAnswerChange, maxChars = 2000 } = props;
  const [isDeleteConfirming, setIsDeleteConfirming] = React.useState(false);

  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-medium">{t("flashcards.field.question")}</span>
          <textarea
            value={question}
            onChange={(e) => {
              onQuestionChange(e.target.value);
            }}
            rows={3}
            maxLength={maxChars}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 w-full resize-y rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
          <span className="text-muted-foreground text-[11px]">
            {question.length}/{maxChars}
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-medium">{t("flashcards.field.answer")}</span>
          <textarea
            value={answer}
            onChange={(e) => {
              onAnswerChange(e.target.value);
            }}
            rows={3}
            maxLength={maxChars}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 w-full resize-y rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
          <span className="text-muted-foreground text-[11px]">
            {answer.length}/{maxChars}
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-[18px] text-xs">
          {props.mode === "persisted" && props.saveError ? (
            <span className="text-destructive">{props.saveError}</span>
          ) : (
            <span className="text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {props.mode === "draft" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                props.onRemove();
              }}
            >
              {t("flashcards.row.remove")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  props.onSave();
                }}
                disabled={props.isSaving || props.isDeleting}
              >
                {props.isSaving ? t("common.saving") : t("common.save")}
              </Button>

              {!isDeleteConfirming ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setIsDeleteConfirming(true);
                  }}
                  disabled={props.isSaving || props.isDeleting}
                >
                  {t("common.delete")}
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
                  >
                    {props.isDeleting ? t("common.deleting") : t("flashcards.row.confirm_delete")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDeleteConfirming(false);
                    }}
                    disabled={props.isSaving || props.isDeleting}
                  >
                    {t("common.cancel")}
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
