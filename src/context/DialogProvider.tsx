import { useCallback, useMemo, useState, type ReactNode } from "react";
import ConfirmModal from "../components/modals/ConfirmModal";
import { DialogContext, type DialogApi } from "./DialogContext";

type OpenDialog =
  | { kind: "confirm"; message: string; resolve: (ok: boolean) => void }
  | { kind: "prompt"; message: string; resolve: (value: string | null) => void };

// Replaces window.confirm / window.prompt with the app's own modal.
export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [value, setValue] = useState("");

  const confirm = useCallback<DialogApi["confirm"]>(
    (message) =>
      new Promise((resolve) => {
        setDialog({ kind: "confirm", message, resolve });
      }),
    [],
  );

  const prompt = useCallback<DialogApi["prompt"]>(
    (message, defaultValue = "") =>
      new Promise((resolve) => {
        setValue(defaultValue);
        setDialog({ kind: "prompt", message, resolve });
      }),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      if (!dialog) return;
      if (dialog.kind === "confirm") dialog.resolve(ok);
      else dialog.resolve(ok ? value : null);
      setDialog(null);
    },
    [dialog, value],
  );
  const handleCancel = useCallback(() => close(false), [close]);
  const handleConfirm = useCallback(() => close(true), [close]);

  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <ConfirmModal isOpen={dialog !== null} onClose={handleCancel} onConfirm={handleConfirm}>
        <p>{dialog?.message}</p>
        {dialog?.kind === "prompt" && (
          <input
            className="input-base"
            style={{ width: "100%" }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
          />
        )}
      </ConfirmModal>
    </DialogContext.Provider>
  );
};
