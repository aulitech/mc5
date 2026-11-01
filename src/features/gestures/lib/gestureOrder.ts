// gestureOrder.ts — The personal gestures list. It's saved (see
// GestureStoreProvider), so a gesture stays in it with no recordings — new,
// or with all of them deleted — until the gesture itself is deleted. Classes
// with recordings that it doesn't list yet join at the end in the order they
// were created. Never alphabetical.

/**
 * The gestures list: the names in `saved`, as saved (with or without
 * recordings), then every other class in `classes` by when it was created.
 */
export function orderGestures(saved: string[], classes: { name: string; firstId: number }[]): string[] {
  const ordered = saved.filter((name, i) => saved.indexOf(name) === i);
  const placed = new Set(ordered);
  const rest = classes.filter((c) => !placed.has(c.name)).sort((a, b) => a.firstId - b.firstId);
  return [...ordered, ...rest.map((c) => c.name)];
}

/** `order` with `oldName` renamed; if `newName` was already listed (a merge), it keeps its own place. */
export function renameIn(order: string[], oldName: string, newName: string): string[] {
  if (order.includes(newName)) return order.filter((n) => n !== oldName);
  return order.map((n) => (n === oldName ? newName : n));
}
