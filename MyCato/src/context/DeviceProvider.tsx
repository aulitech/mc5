import { useCallback, useMemo, useState, type ReactNode } from "react";
import ota from "../device/ota";
import { useOtaEvent } from "../device/useOtaEvent";
import { errorMessage, notify } from "../lib/notify";
import type { CatoDevice, DeviceStatus } from "../types/device";
import { DeviceContext } from "./DeviceContext";

const NO_GESTURES: string[] = [];

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [device, setDevice] = useState<CatoDevice | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useOtaEvent("connect", setDevice);
  useOtaEvent("status", setStatus);
  useOtaEvent("disconnect", () => {
    console.log("Device disconnected");
    setDevice(null);
    setStatus(null);
  });

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await ota.connect();
    } catch (err) {
      notify.error(`Connection error: ${errorMessage(err)}`);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await ota.close().catch((err) => notify.error(errorMessage(err)));
  }, []);

  const value = useMemo(
    () => ({
      device,
      status,
      isConnecting,
      gestureNames: device?.info.gesture_list ?? NO_GESTURES,
      connect,
      disconnect,
    }),
    [device, status, isConnecting, connect, disconnect],
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
};
