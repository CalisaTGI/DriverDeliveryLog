import { openDB, DBSchema, IDBPDatabase } from 'idb';

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

export interface QueuedSubmissionItem {
  id: string;
  createdAt: string;
  payload: DaySubmissionPayload;
  attempts?: number;
}

export interface ShiftDraft {
  id: string; // 'active'
  date: string;
  driver: string;
  jobs: any[];
  arrivalTimeBack: string;
  lastSavedAt: string;
}

interface AppDB extends DBSchema {
  locations: {
    key: string;
    value: { name: string; cachedAt: string };
  };
  drivers: {
    key: string;
    value: { name: string; cachedAt: string };
  };
  pending_submissions: {
    key: string;
    value: QueuedSubmissionItem;
  };
  shift_draft: {
    key: string;
    value: ShiftDraft;
  };
  cached_logs: {
    key: number;
    value: any;
  };
}

const DB_NAME = 'driver-delivery-log-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<AppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('locations')) {
          db.createObjectStore('locations', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('drivers')) {
          db.createObjectStore('drivers', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('pending_submissions')) {
          db.createObjectStore('pending_submissions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('shift_draft')) {
          db.createObjectStore('shift_draft', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cached_logs')) {
          db.createObjectStore('cached_logs', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

/* ── LOCATIONS CACHE ────────────────────────────────────────── */
export async function saveLocationsIdb(locations: string[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('locations', 'readwrite');
    await tx.store.clear();
    const now = new Date().toISOString();
    for (const name of locations) {
      await tx.store.put({ name, cachedAt: now });
    }
    await tx.done;
  } catch (err) {
    console.error('Failed to save locations to IndexedDB:', err);
  }
}

export async function getLocationsIdb(): Promise<string[]> {
  try {
    const db = await getDb();
    const records = await db.getAll('locations');
    return records.map((r) => r.name);
  } catch (err) {
    console.error('Failed to get locations from IndexedDB:', err);
    return [];
  }
}

/* ── DRIVERS CACHE ────────────────────────────────────────── */
export async function saveDriversIdb(drivers: string[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('drivers', 'readwrite');
    await tx.store.clear();
    const now = new Date().toISOString();
    for (const name of drivers) {
      await tx.store.put({ name, cachedAt: now });
    }
    await tx.done;
  } catch (err) {
    console.error('Failed to save drivers to IndexedDB:', err);
  }
}

export async function getDriversIdb(): Promise<string[]> {
  try {
    const db = await getDb();
    const records = await db.getAll('drivers');
    return records.map((r) => r.name);
  } catch (err) {
    console.error('Failed to get drivers from IndexedDB:', err);
    return [];
  }
}

/* ── PENDING SUBMISSIONS QUEUE ───────────────────────────────── */
export async function enqueueSubmissionIdb(payload: DaySubmissionPayload): Promise<QueuedSubmissionItem> {
  const txId = payload.clientTxId || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const item: QueuedSubmissionItem = {
    id: txId,
    createdAt: new Date().toISOString(),
    payload: {
      ...payload,
      clientTxId: txId,
    },
    attempts: 0,
  };

  try {
    const db = await getDb();
    await db.put('pending_submissions', item);
  } catch (err) {
    console.error('Failed to enqueue submission to IndexedDB:', err);
  }
  return item;
}

export async function getPendingSubmissionsIdb(): Promise<QueuedSubmissionItem[]> {
  try {
    const db = await getDb();
    return await db.getAll('pending_submissions');
  } catch (err) {
    console.error('Failed to get pending submissions from IndexedDB:', err);
    return [];
  }
}

export async function dequeueSubmissionIdb(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('pending_submissions', id);
  } catch (err) {
    console.error('Failed to remove pending submission from IndexedDB:', err);
  }
}

export async function clearPendingSubmissionsIdb(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear('pending_submissions');
  } catch (err) {
    console.error('Failed to clear pending submissions in IndexedDB:', err);
  }
}

/* ── SHIFT DRAFT ────────────────────────────────────────────── */
export async function saveShiftDraftIdb(draftData: Omit<ShiftDraft, 'id'>): Promise<void> {
  try {
    const db = await getDb();
    await db.put('shift_draft', {
      id: 'active',
      ...draftData,
    });
  } catch (err) {
    console.error('Failed to save shift draft to IndexedDB:', err);
  }
}

export async function getShiftDraftIdb(): Promise<ShiftDraft | null> {
  try {
    const db = await getDb();
    const draft = await db.get('shift_draft', 'active');
    return draft || null;
  } catch (err) {
    console.error('Failed to read shift draft from IndexedDB:', err);
    return null;
  }
}

export async function clearShiftDraftIdb(): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('shift_draft', 'active');
  } catch (err) {
    console.error('Failed to clear shift draft in IndexedDB:', err);
  }
}

/* ── CACHED LOGS (BILLING/ADMIN) ────────────────────────────── */
export async function saveCachedLogsIdb(logs: any[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('cached_logs', 'readwrite');
    await tx.store.clear();
    for (const log of logs) {
      await tx.store.put(log);
    }
    await tx.done;
  } catch (err) {
    console.error('Failed to save cached logs to IndexedDB:', err);
  }
}

export async function getCachedLogsIdb(): Promise<any[]> {
  try {
    const db = await getDb();
    return await db.getAll('cached_logs');
  } catch (err) {
    console.error('Failed to read cached logs from IndexedDB:', err);
    return [];
  }
}
