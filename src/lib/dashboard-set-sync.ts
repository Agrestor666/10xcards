/** Cross-island sync on dashboard: set create/rename/delete and generator save → tiles and hero. */

import type { DashboardSetRow } from "@/types";

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

export const DASHBOARD_SET_DELETED = "dashboard-set-deleted";

export interface DashboardSetDeletedDetail {
  setId: string;
  dueCount: number;
}

export function dispatchDashboardSetDeleted(detail: DashboardSetDeletedDetail): void {
  window.dispatchEvent(new CustomEvent(DASHBOARD_SET_DELETED, { detail }));
}

export const DASHBOARD_SET_CREATED = "dashboard-set-created";

export interface DashboardSetCreatedDetail {
  set: DashboardSetRow;
}

export function dispatchDashboardSetCreated(detail: DashboardSetCreatedDetail): void {
  window.dispatchEvent(new CustomEvent(DASHBOARD_SET_CREATED, { detail }));
}

export const DASHBOARD_SET_UPDATED = "dashboard-set-updated";

export interface DashboardSetUpdatedDetail {
  id: string;
  name: string;
}

export function dispatchDashboardSetUpdated(detail: DashboardSetUpdatedDetail): void {
  window.dispatchEvent(new CustomEvent(DASHBOARD_SET_UPDATED, { detail }));
}

export const DASHBOARD_SET_REVIEW_GRADED = "dashboard-set-review-graded";

export interface DashboardSetReviewGradedDetail {
  setId: string;
  /** Due cards cleared by this grade (default 1). */
  dueRemovedCount?: number;
}

export function dispatchDashboardSetReviewGraded(detail: DashboardSetReviewGradedDetail): void {
  window.dispatchEvent(new CustomEvent(DASHBOARD_SET_REVIEW_GRADED, { detail }));
}

type DueSummaryResponse =
  | { ok: true; totalDue: number; dueBySetId: Record<string, number> }
  | { ok: false; message: string };

export async function fetchDashboardDueSummary(): Promise<{
  totalDue: number;
  dueBySetId: Record<string, number>;
} | null> {
  try {
    const res = await fetch("/api/dashboard/due-summary", { method: "GET", credentials: "include" });
    const body = (await res.json()) as DueSummaryResponse;
    if (!body.ok) {
      return null;
    }
    return { totalDue: body.totalDue, dueBySetId: body.dueBySetId };
  } catch {
    return null;
  }
}
