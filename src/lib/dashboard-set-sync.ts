/** Cross-island sync on dashboard: generator save → set list card counts. */

export const DASHBOARD_SET_CARDS_ADDED = "dashboard-set-cards-added";

export interface DashboardSetCardsAddedDetail {
  setId: string;
  addedCount: number;
  /** Cards due now; defaults to addedCount when new cards use default due_at. */
  dueAddedCount?: number;
}

export function dispatchDashboardSetCardsAdded(detail: DashboardSetCardsAddedDetail): void {
  window.dispatchEvent(new CustomEvent(DASHBOARD_SET_CARDS_ADDED, { detail }));
}
