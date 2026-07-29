import { Job } from "../types/deliveryLog";
import { saveShiftDraftIdb, getShiftDraftIdb, clearShiftDraftIdb } from "../../offline/db";

export interface ActiveShiftDraft {
  date: string;
  driver: string;
  jobs: Job[];
  arrivalTimeBack: string;
  lastSavedAt: string;
}

const DRAFT_KEY = "driver_delivery_active_draft_v1";

export function saveShiftDraft(draft: Omit<ActiveShiftDraft, "lastSavedAt">): void {
  const fullDraft: ActiveShiftDraft = {
    ...draft,
    lastSavedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(fullDraft));
  } catch (err) {
    console.error("Failed to save shift draft to localStorage:", err);
  }
  saveShiftDraftIdb(fullDraft).catch((err) =>
    console.error("Failed to save shift draft to IndexedDB:", err)
  );
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

export async function getShiftDraftAsync(): Promise<ActiveShiftDraft | null> {
  try {
    const idbDraft = await getShiftDraftIdb();
    if (idbDraft) {
      return {
        date: idbDraft.date,
        driver: idbDraft.driver,
        jobs: idbDraft.jobs,
        arrivalTimeBack: idbDraft.arrivalTimeBack,
        lastSavedAt: idbDraft.lastSavedAt,
      };
    }
  } catch (err) {
    console.error("Failed to read shift draft from IndexedDB:", err);
  }
  return getShiftDraft();
}

export function clearShiftDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (err) {
    console.error("Failed to clear shift draft from localStorage:", err);
  }
  clearShiftDraftIdb().catch((err) =>
    console.error("Failed to clear shift draft from IndexedDB:", err)
  );
}

export function hasActiveDraft(): boolean {
  return getShiftDraft() !== null;
}
