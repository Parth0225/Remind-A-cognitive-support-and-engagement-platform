import { api } from "./api";

export interface QueuedEvent {
  id: string;
  account_id: string;
  event_type: "activity_completed" | "reminder_create" | "reminder_update";
  payload: Record<string, unknown>;
  queued_at: string;
}

interface Snapshot {
  key: string;
  value: unknown;
  saved_at: string;
}

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support offline storage."));
      return;
    }
    const request = indexedDB.open("remind-local", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("events")) {
        database.createObjectStore("events", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("snapshots")) {
        database.createObjectStore("snapshots", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });
}

async function storeRequest<T>(
  storeName: "events" | "snapshots",
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openStore();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = run(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Offline storage transaction failed."));
    };
  });
}

export async function queueEvent(
  accountId: string,
  event_type: QueuedEvent["event_type"],
  payload: Record<string, unknown>,
): Promise<QueuedEvent> {
  const event: QueuedEvent = {
    id: crypto.randomUUID(),
    account_id: accountId,
    event_type,
    payload,
    queued_at: new Date().toISOString(),
  };
  await storeRequest("events", "readwrite", (store) => store.put(event));
  return event;
}

export async function listQueuedEvents(accountId: string): Promise<QueuedEvent[]> {
  const events = await storeRequest<QueuedEvent[]>("events", "readonly", (store) => store.getAll());
  return events.filter((event) => event.account_id === accountId);
}

export async function removeQueuedEvent(id: string): Promise<void> {
  await storeRequest("events", "readwrite", (store) => store.delete(id));
}

export async function saveDashboardSnapshot(accountId: string, value: unknown): Promise<void> {
  const snapshot: Snapshot = { key: `patient-dashboard:${accountId}`, value, saved_at: new Date().toISOString() };
  await storeRequest("snapshots", "readwrite", (store) => store.put(snapshot));
}

export async function loadDashboardSnapshot(accountId: string): Promise<Snapshot | undefined> {
  return storeRequest("snapshots", "readonly", (store) => store.get(`patient-dashboard:${accountId}`));
}

export async function synchronizeQueue(accountId: string): Promise<string[]> {
  const queued = await listQueuedEvents(accountId);
  const events = queued.map(({ id, event_type, payload }) => ({ id, event_type, payload }));
  if (!events.length) return [];
  const response = await api<{ results: Array<{ event_id: string; synced: boolean; message?: string }> }>(
    "/patient/sync",
    {
      method: "POST",
      body: JSON.stringify({ events }),
    },
  );
  const notices: string[] = [];
  for (const result of response.results) {
    if (result.synced || result.message) {
      await removeQueuedEvent(result.event_id);
      if (!result.synced && result.message) notices.push(result.message);
    }
  }
  return notices;
}
