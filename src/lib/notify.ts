// notify.ts — App-wide toast notifications, usable from React and non-React
// code alike. <Toaster /> renders whatever is in the store.

export type ToastKind = "error" | "info" | "success";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const AUTO_DISMISS_MS: Record<ToastKind, number> = {
  error: 10000,
  info: 5000,
  success: 4000,
};

let toasts: Toast[] = [];
let nextId = 1;
const subscribers = new Set<() => void>();

function publish(next: Toast[]) {
  toasts = next;
  subscribers.forEach((fn) => fn());
}

export function dismiss(id: number) {
  publish(toasts.filter((t) => t.id !== id));
}

function push(kind: ToastKind, message: string) {
  const id = nextId++;
  publish([...toasts, { id, kind, message }]);
  setTimeout(() => dismiss(id), AUTO_DISMISS_MS[kind]);
}

export const notify = {
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
  success: (message: string) => push("success", message),
};

export function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export const getToasts = () => toasts;

/** Readable message from an unknown thrown value. */
export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);
