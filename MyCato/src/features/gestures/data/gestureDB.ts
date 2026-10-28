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

// Runs fn on every recording filed under gestureName, in one readwrite
// transaction. Resolves once the transaction has committed.
async function forEachInGesture(
  gestureName: string,
  fn: (cursor: IDBCursorWithValue) => void,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_RECORDINGS, "readwrite");
  const index = tx.objectStore(STORE_RECORDINGS).index("gestureName");
  return new Promise((resolve, reject) => {
    // openCursor iterates over every record matching the index key.
    const request = index.openCursor(gestureName);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        fn(cursor);
        cursor.continue(); // move to next matching record
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
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
  return (await promisify(store.add(record))) as number;
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
  const all: Recording[] = await promisify(tx.objectStore(STORE_RECORDINGS).getAll());
  return all.reduce<Record<string, number>>((counts, record) => {
    counts[record.gestureName] = (counts[record.gestureName] || 0) + 1;
    return counts;
  }, {});
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
  await promisify(tx.objectStore(STORE_RECORDINGS).delete(id));
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
  const id = (await promisify(store.add(record))) as number;
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
  await promisify(tx.objectStore(STORE_MODELS).delete(id));
}
