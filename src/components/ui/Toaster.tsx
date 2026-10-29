import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { dismiss, getToasts, subscribe, type ToastKind } from "../../lib/notify";

const ACCENT: Record<ToastKind, string> = {
  error: "var(--danger)",
  info: "var(--led-blue)",
  success: "var(--success)",
};

const Toaster = () => {
  const toasts = useSyncExternalStore(subscribe, getToasts);
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1rem",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        maxWidth: "min(28rem, calc(100vw - 2rem))",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            backgroundColor: "var(--bg-card)",
            color: "var(--color-card)",
            border: "1px solid var(--border)",
            borderLeft: `4px solid ${ACCENT[t.kind]}`,
            borderRadius: "6px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}
        >
          <span style={{ flex: 1, overflowWrap: "anywhere" }}>{t.message}</span>
          {t.action && (
            <button
              className="btn-primary"
              onClick={() => {
                dismiss(t.id);
                t.action!.onClick();
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="btn-ghost" onClick={() => dismiss(t.id)} title="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toaster;
