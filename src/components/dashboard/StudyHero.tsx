import * as React from "react";
import {
  DASHBOARD_SET_CARDS_ADDED,
  DASHBOARD_SET_DELETED,
  DASHBOARD_SET_REVIEW_GRADED,
  fetchDashboardDueSummary,
  type DashboardSetCardsAddedDetail,
  type DashboardSetDeletedDetail,
  type DashboardSetReviewGradedDetail,
} from "@/lib/dashboard-set-sync";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { useLocale } from "@/components/i18n/useLocale";
import { tPlural } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";
import { NewSetDialog } from "@/components/dashboard/NewSetDialog";

function StudyHeroInner({ initialTotalDue, hasSets }: { initialTotalDue: number; hasSets: boolean }) {
  const { locale, t } = useLocale();
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

    function onReviewGraded(event: Event) {
      const detail = (event as CustomEvent<DashboardSetReviewGradedDetail>).detail;
      const delta = detail.dueRemovedCount ?? 1;
      setTotalDue((prev) => Math.max(0, prev - delta));
    }

    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      void fetchDashboardDueSummary().then((summary) => {
        if (summary) {
          setTotalDue(summary.totalDue);
        }
      });
    }

    window.addEventListener(DASHBOARD_SET_CARDS_ADDED, onCardsAdded);
    window.addEventListener(DASHBOARD_SET_DELETED, onSetDeleted);
    window.addEventListener(DASHBOARD_SET_REVIEW_GRADED, onReviewGraded);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener(DASHBOARD_SET_CARDS_ADDED, onCardsAdded);
      window.removeEventListener(DASHBOARD_SET_DELETED, onSetDeleted);
      window.removeEventListener(DASHBOARD_SET_REVIEW_GRADED, onReviewGraded);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  if (!hasSets) {
    return (
      <header className={cn("border-border bg-card rounded-2xl border p-8 shadow-sm")}>
        <h1 className="font-display text-4xl tracking-tight">{t("dashboard.hero.empty.title")}</h1>
        <p className="text-muted-foreground mt-3 max-w-prose">{t("dashboard.hero.empty.description")}</p>
        <div className="mt-6">
          <NewSetDialog triggerLabel={t("dashboard.hero.empty.cta")} triggerVariant="primary" />
        </div>
      </header>
    );
  }

  if (totalDue > 0) {
    const label = tPlural(locale, "dashboard.hero.due.title", totalDue);
    return (
      <header className={cn("border-border bg-card rounded-2xl border p-8 shadow-sm")}>
        <h1 className="font-display text-4xl tracking-tight">{label}</h1>
        <p className="text-muted-foreground mt-3">{t("dashboard.hero.due.subtitle")}</p>
      </header>
    );
  }

  return (
    <header className={cn("border-border bg-card rounded-2xl border p-8 shadow-sm")}>
      <h1 className="font-display text-4xl tracking-tight">{t("dashboard.hero.caught_up.title")}</h1>
      <p className="text-muted-foreground mt-3">{t("dashboard.hero.caught_up.subtitle")}</p>
    </header>
  );
}

export function StudyHero({
  locale,
  initialTotalDue,
  hasSets,
}: {
  locale: AppLocale;
  initialTotalDue: number;
  hasSets: boolean;
}) {
  return (
    <LocaleProvider locale={locale}>
      <StudyHeroInner initialTotalDue={initialTotalDue} hasSets={hasSets} />
    </LocaleProvider>
  );
}
