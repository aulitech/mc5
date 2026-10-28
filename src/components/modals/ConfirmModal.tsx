import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}

const FOCUSABLE = "input, select, textarea, button";

const ConfirmModal = ({ isOpen, onClose, onConfirm, children }: ConfirmModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Delay the "in" state a tick so the opacity/transform transition runs.
    const timer = setTimeout(() => setIsAnimating(isOpen), isOpen ? 10 : 0);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Focus the first control on open; keep Tab inside the dialog.
  useEffect(() => {
    if (!isOpen) return;
    modalRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const modalNode = modalRef.current;
    if (!modalNode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = modalNode.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last?.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first?.focus();
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalOverlayStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    opacity: isAnimating ? 1 : 0,
    transition: "opacity 200ms ease-in-out",
  };

  const modalStyle: CSSProperties = {
    backgroundColor: "var(--bg-card)",
    padding: "2rem",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
    color: "var(--color)",
    minWidth: "300px",
    maxWidth: "800px",
    opacity: isAnimating ? 1 : 0,
    transform: isAnimating ? "translateY(0)" : "translateY(-20px)",
    transition: "opacity 200ms ease-out, transform 200ms ease-out",
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
      >
        <div style={{ margin: "0 0 1.5rem", fontSize: "large" }}>
          {children}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "1rem",
          }}
        >
          <button onClick={onClose}>Cancel</button>
          <button onClick={onConfirm} className="active">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
