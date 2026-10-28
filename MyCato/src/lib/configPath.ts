// configPath.ts — Immutable get/set/remove by path for the config tree.
// Only the containers along the path are copied; everything else is shared.

import type { ConfigPath } from "../types/config";

type Container = Record<string | number, unknown> | unknown[];

const isContainer = (v: unknown): v is Container => typeof v === "object" && v !== null;

const shallowCopy = (v: Container): Container => (Array.isArray(v) ? [...v] : { ...v });

export function getAt(root: unknown, path: ConfigPath): unknown {
  let curr = root;
  for (const key of path) {
    if (!isContainer(curr)) return undefined;
    curr = (curr as Record<string | number, unknown>)[key];
  }
  return curr;
}

export function setAt<T>(root: T, path: ConfigPath, value: unknown): T {
  if (path.length === 0) return value as T;
  const [key, ...rest] = path;
  const copy = isContainer(root) ? shallowCopy(root) : {};
  const child = (copy as Record<string | number, unknown>)[key];
  (copy as Record<string | number, unknown>)[key] = setAt(child, rest, value);
  return copy as T;
}

/** Remove the item at path: splices arrays, deletes object keys. */
export function removeAt<T>(root: T, path: ConfigPath): T {
  if (path.length === 0) return root;
  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  const parent = getAt(root, parentPath);
  if (!isContainer(parent)) return root;

  let next: Container;
  if (Array.isArray(parent)) {
    next = parent.filter((_, i) => i !== Number(key));
  } else {
    next = { ...parent };
    delete next[key];
  }
  return setAt(root, parentPath, next);
}

/** Device-side path string, e.g. ["profiles", 0, "name"] → "/profiles/0/name". */
export const toDevicePath = (path: ConfigPath) => `/${path.join("/")}`;
