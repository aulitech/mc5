// gestureDB.ts — IndexedDB wrapper for gesture data storage.
//
// Think of this file as the "filing cabinet" for the app. Every time you save
// a gesture recording or generate a template, this module handles putting it
// in the right drawer and retrieving it later. No other component needs to
// know how IndexedDB works — they just call these functions.
//
// IndexedDB is a key-value store built into every browser. It survives page
// refreshes and requires no internet connection. It's asynchronous, meaning
// every read/write returns a Promise that you must await.

import type { GestureModel, ModelGesture, Recording, Sample } from "../../../types/gestures";

const DB_NAME = "gestureDB";
const DB_VERSION = 1;
const STORE_RECORDINGS = "gesture_data";
const STORE_MODELS = "gesture_models";

// Opens (or creates) the database, returning a Promise<IDBDatabase>.
// This is called automatically by every exported function — you never need
// to call it directly. The connection is opened once and reused.
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  dbPromise ??= openConnection().catch((err) => {
    dbPromise = null; // allow a retry on the next call
    throw err;
  });
  return dbPromise;
}

function openConnection(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // onupgradeneeded runs only when the DB is first created or the version
    // number increases. This is where we define the "schema" — the structure
    // of the object stores (like tables in SQL).
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
        // autoIncrement: true means IndexedDB assigns an ID (1, 2, 3…)
        // automatically every time we add a record.
        const recStore = db.createObjectStore(STORE_RECORDINGS, {
          keyPath: "id",
          autoIncrement: true,
        });
        // An "index" lets us search efficiently by a specific field.
        // Without an index, searching by gestureName would mean reading
        // every record — like scanning every page of a book vs. using the index.
        recStore.createIndex("gestureName", "gestureName", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_MODELS)) {
        const modelStore = db.createObjectStore(STORE_MODELS, {
          keyPath: "id",
          autoIncrement: true,
        });
        modelStore.createIndex("modelName", "modelName", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Wraps an IDBRequest in a Promise so we can use async/await cleanly.
function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Resolves once a readwrite transaction has committed (or rejects if it
// aborts) — a request's own success only means it was queued.
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Runs fn on every recording filed under gestureName, in one readwrite
// transaction. Resolves once the transaction has committed.
async function forEachInGesture(
  gestureName: string,
  fn: (cursor: IDBCursorWithValue) => void,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_RECORDINGS, "readwrite");
  const index = tx.objectStore(STORE_RECORDINGS).index("gestureName");
  // openCursor iterates over every record matching the index key.
  const request = index.openCursor(gestureName);
  request.onsuccess = () => {
    const cursor = request.result;
    if (cursor) {
      fn(cursor);
      cursor.continue(); // move to next matching record
    }
  };
  return txDone(tx);
}

// ─── Recordings ───────────────────────────────────────────────────────────────

/**
 * Save a raw gesture recording to IndexedDB.
 * @param gestureName - The class label (e.g., "nod", "shake")
 * @param data - Parsed IMU samples
 * @returns The auto-assigned record ID
 */
export async function saveRecording(gestureName: string, data: Sample[]): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_RECORDINGS, "readwrite");
  const store = tx.objectStore(STORE_RECORDINGS);
  const record = {
    gestureName,
    timestamp: new Date().toISOString(),
    data,
  };
  const done = txDone(tx);
  const id = (await promisify(store.add(record))) as number;
  await done;
  return id;
}

/**
 * Add recordings that keep their own class and timestamp (an import), in one
 * transaction — all are added or none.
 */
export async function addRecordings(recordings: Omit<Recording, "id">[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_RECORDINGS, "readwrite");
  const store = tx.objectStore(STORE_RECORDINGS);
  for (const { gestureName, timestamp, data } of recordings) store.add({ gestureName, timestamp, data });
  await txDone(tx);
}

/**
 * Fetch every stored recording, in the order they were saved.
 */
export async function getAllRecordings(): Promise<Recording[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_RECORDINGS, "readonly");
  return promisify(tx.objectStore(STORE_RECORDINGS).getAll());
}

/**
 * Fetch all recordings for a specific gesture class.
 */
export async function getRecordingsForGesture(gestureName: string): Promise<Recording[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_RECORDINGS, "readonly");
  const index = tx.objectStore(STORE_RECORDINGS).index("gestureName");
  return promisify(index.getAll(gestureName));
}

/**
 * Get a count of recordings per gesture class, e.g. { nod: 5, shake: 3 }.
 */
export async function getGestureCounts(): Promise<Record<string, number>> {
  const db = await openDB();
  const tx = db.transaction(STORE_RECORDINGS, "readonly");
  const index = tx.objectStore(STORE_RECORDINGS).index("gestureName");
  const counts: Record<string, number> = {};
  return new Promise((resolve, reject) => {
    // A key cursor walks the index only — no recording's samples are loaded.
    const request = index.openKeyCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(counts);
        return;
      }
      const name = String(cursor.key);
      counts[name] = (counts[name] || 0) + 1;
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete all recordings for a gesture class.
 */
export function deleteGesture(gestureName: string): Promise<void> {
  return forEachInGesture(gestureName, (cursor) => cursor.delete());
}

/**
 * Rename a gesture class — relabels every recording currently filed under
 * `oldName` to `newName`. If `newName` already exists as a class, this
 * effectively merges the two.
 */
export function renameGesture(oldName: string, newName: string): Promise<void> {
  return forEachInGesture(oldName, (cursor) =>
    cursor.update({ ...cursor.value, gestureName: newName }),
  );
}

/**
 * Delete a single recording by its auto-assigned ID.
 */
export async function deleteRecording(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_RECORDINGS, "readwrite");
  tx.objectStore(STORE_RECORDINGS).delete(id);
  await txDone(tx);
}

// ─── Models (templates) ────────────────────────────────────────────────────────

/**
 * Save a generated gesture template model.
 * @param modelName - User-provided name
 * @param templates - { [gestureName]: { template, keptCount, totalCount } }
 * @returns The saved model, including its auto-assigned ID
 */
export async function saveModel(
  modelName: string,
  templates: Record<string, ModelGesture>,
): Promise<GestureModel> {
  const db = await openDB();
  const tx = db.transaction(STORE_MODELS, "readwrite");
  const store = tx.objectStore(STORE_MODELS);
  const record = {
    modelName,
    createdAt: new Date().toISOString(),
    templates,
  };
  const done = txDone(tx);
  const id = (await promisify(store.add(record))) as number;
  await done;
  return { id, ...record };
}

/**
 * Fetch all stored gesture models.
 */
export async function getAllModels(): Promise<GestureModel[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_MODELS, "readonly");
  return promisify(tx.objectStore(STORE_MODELS).getAll());
}

/**
 * Delete a stored model by its auto-assigned ID.
 */
export async function deleteModel(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_MODELS, "readwrite");
  tx.objectStore(STORE_MODELS).delete(id);
  await txDone(tx);
}
