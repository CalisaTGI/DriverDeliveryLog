import { Job } from "../types/deliveryLog";

export interface ActiveShiftDraft {
  date: string;
  driver: string;
  jobs: Job[];
  arrivalTimeBack: string;
  lastSavedAt: string;
}

const DRAFT_KEY = "driver_delivery_active_draft_v1";

export function saveShiftDraft(draft: Omit<ActiveShiftDraft, "lastSavedAt">): void {
  try {
    const fullDraft: ActiveShiftDraft = {
      ...draft,
      lastSavedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(fullDraft));
  } catch (err) {
    console.error("Failed to save shift draft to localStorage:", err);
  }
}

export function getShiftDraft(): ActiveShiftDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("Failed to read shift draft from localStorage:", err);
    return null;
  }
}

export function clearShiftDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (err) {
    console.error("Failed to clear shift draft from localStorage:", err);
  }
}

export function hasActiveDraft(): boolean {
  return getShiftDraft() !== null;
}
