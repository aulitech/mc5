import { createContext, useContext } from "react";
import type { CatoDevice, DeviceStatus } from "../types/device";

export interface DeviceContextValue {
  device: CatoDevice | null;
  status: DeviceStatus | null;
  isConnecting: boolean;
  /** Gesture class labels reported by the device (empty when disconnected). */
  gestureNames: string[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const DeviceContext = createContext<DeviceContextValue | null>(null);

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) throw new Error("useDevice must be used within a DeviceProvider");
  return context;
};
