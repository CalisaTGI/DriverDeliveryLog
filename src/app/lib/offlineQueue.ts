export interface QueuedJob {
  jobNumber: string;
  task: string;
  paperwork: boolean;
  location: string;
  startTime: string;
  stopTime: string;
  totalTime?: string;
}

export interface DaySubmissionPayload {
  clientTxId?: string;
  date: string;
  driver: string;
  jobs: QueuedJob[];
  arrivalBackTime: string;
}

export interface QueuedSubmission {
  id: string;
  createdAt: string;
  payload: DaySubmissionPayload;
}

const QUEUE_KEY = "driver_delivery_offline_queue_v1";
const LOCATIONS_CACHE_KEY = "driver_delivery_cached_locations_v1";

export function getQueue(): QueuedSubmission[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to read offline queue from localStorage:", err);
    return [];
  }
}

export function enqueueSubmission(payload: DaySubmissionPayload): QueuedSubmission {
  const queue = getQueue();
  const txId = payload.clientTxId || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newItem: QueuedSubmission = {
    id: txId,
    createdAt: new Date().toISOString(),
    payload: {
      ...payload,
      clientTxId: txId,
    },
  };
  queue.push(newItem);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to write to offline queue in localStorage:", err);
  }
  return newItem;
}

export function dequeueSubmission(id: string): void {
  const queue = getQueue().filter((item) => item.id !== id);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to update offline queue in localStorage:", err);
  }
}

export function clearQueue(): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error("Failed to clear offline queue in localStorage:", err);
  }
}

export function cacheLocations(locations: string[]): void {
  if (!locations || locations.length === 0) return;
  try {
    localStorage.setItem(LOCATIONS_CACHE_KEY, JSON.stringify(locations));
  } catch (err) {
    console.error("Failed to cache locations in localStorage:", err);
  }
}

export function getCachedLocations(): string[] {
  try {
    const raw = localStorage.getItem(LOCATIONS_CACHE_KEY);
    return raw ? JSON.parse(raw) : ["Flint PO", "Metroplex"];
  } catch (err) {
    return ["Flint PO", "Metroplex"];
  }
}
