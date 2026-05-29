import * as React from "react";
import {
  DASHBOARD_SET_CARDS_ADDED,
  DASHBOARD_SET_DELETED,
  type DashboardSetCardsAddedDetail,
  type DashboardSetDeletedDetail,
} from "@/lib/dashboard-set-sync";
import { cn } from "@/lib/utils";
import { NewSetDialog } from "@/components/dashboard/NewSetDialog";

export function StudyHero({ initialTotalDue, hasSets }: { initialTotalDue: number; hasSets: boolean }) {
  const [totalDue, setTotalDue] = React.useState(initialTotalDue);

  React.useEffect(() => {
    function onCardsAdded(event: Event) {
      const detail = (event as CustomEvent<DashboardSetCardsAddedDetail>).detail;
      const dueDelta = detail.dueAddedCount ?? detail.addedCount;
      setTotalDue((prev) => prev + dueDelta);
    }

    function onSetDeleted(event: Event) {
      const detail = (event as CustomEvent<DashboardSetDeletedDetail>).detail;
      setTotalDue((prev) => Math.max(0, prev - detail.dueCount));
    }

    window.addEventListener(DASHBOARD_SET_CARDS_ADDED, onCardsAdded);
    window.addEventListener(DASHBOARD_SET_DELETED, onSetDeleted);
    return () => {
      window.removeEventListener(DASHBOARD_SET_CARDS_ADDED, onCardsAdded);
      window.removeEventListener(DASHBOARD_SET_DELETED, onSetDeleted);
    };
  }, []);

  if (!hasSets) {
    return (
      <header className={cn("border-border bg-card rounded-2xl border p-8 shadow-sm")}>
        <h1 className="font-display text-4xl tracking-tight">Your study hub</h1>
        <p className="text-muted-foreground mt-3 max-w-prose">
          Create your first set to start studying with spaced repetition.
        </p>
        <div className="mt-6">
          <NewSetDialog triggerLabel="Create your first set" triggerVariant="primary" />
        </div>
      </header>
    );
  }

  if (totalDue > 0) {
    const label = totalDue === 1 ? "1 card due today" : `${totalDue} cards due today`;
    return (
      <header className={cn("border-border bg-card rounded-2xl border p-8 shadow-sm")}>
        <h1 className="font-display text-4xl tracking-tight">{label}</h1>
        <p className="text-muted-foreground mt-3">Pick a set below and hit Study when you are ready.</p>
      </header>
    );
  }

  return (
    <header className={cn("border-border bg-card rounded-2xl border p-8 shadow-sm")}>
      <h1 className="font-display text-4xl tracking-tight">You&apos;re all caught up</h1>
      <p className="text-muted-foreground mt-3">No cards are due right now. Add more cards or check back later.</p>
    </header>
  );
}
