// gestureOrder.ts — The order of the saved gestures list: the user's own
// (set by dragging), with any class it doesn't mention after it in the order
// the classes were created. Never alphabetical.

/**
 * Display order for `classes`: the names in `saved` that still have
 * recordings, as saved, then every other class by when it was created.
 */
export function orderGestures(saved: string[], classes: { name: string; firstId: number }[]): string[] {
  const existing = new Set(classes.map((c) => c.name));
  const ordered = saved.filter((name, i) => existing.has(name) && saved.indexOf(name) === i);
  const placed = new Set(ordered);
  const rest = classes.filter((c) => !placed.has(c.name)).sort((a, b) => a.firstId - b.firstId);
  return [...ordered, ...rest.map((c) => c.name)];
}

/** `order` with `name` moved to position `toIndex` (clamped). */
export function moveTo(order: string[], name: string, toIndex: number): string[] {
  const from = order.indexOf(name);
  if (from < 0) return order;
  const next = order.filter((n) => n !== name);
  const to = Math.max(0, Math.min(next.length, toIndex));
  next.splice(to, 0, name);
  return next;
}

/** `order` with `oldName` renamed; if `newName` was already listed (a merge), it keeps its own place. */
export function renameIn(order: string[], oldName: string, newName: string): string[] {
  if (order.includes(newName)) return order.filter((n) => n !== oldName);
  return order.map((n) => (n === oldName ? newName : n));
}
