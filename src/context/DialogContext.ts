import { createContext, useContext } from "react";

export interface DialogApi {
  /** Resolves true if the user confirmed. */
  confirm: (message: string) => Promise<boolean>;
  /** Resolves with the entered text, or null if cancelled. */
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

export const DialogContext = createContext<DialogApi | null>(null);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useDialog must be used within a DialogProvider");
  return context;
};
