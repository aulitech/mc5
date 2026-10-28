import React, { useEffect, useRef, useState } from "react";

const ConfirmModal = ({ isOpen, onClose, onConfirm, children }) => {
  const modalRef = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Use a timeout to allow the component to mount before starting the animation
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setIsAnimating(false), 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const modalNode = modalRef.current;
    if (!modalNode) return;

    const focusableElements = modalNode.querySelectorAll("input, button");
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "Tab") {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else if (document.activeElement === lastElement) {
          firstElement.focus();
          event.preventDefault();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalOverlayStyle = {
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

  const modalStyle = {
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