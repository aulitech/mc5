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
  const [isReconnecting, setIsReconnecting] = useState(false);

  useOtaEvent("connect", (connected) => {
    setDevice(connected);
    setIsReconnecting(false);
  });
  useOtaEvent("status", setStatus);
  useOtaEvent("disconnect", ({ reconnecting, error }) => {
    console.log("Device disconnected", reconnecting ? "(waiting for it to come back)" : "");
    setDevice(null);
    setStatus(null);
    setIsReconnecting(reconnecting);
    if (error) notify.error(`Couldn't reconnect to Cato. Click Connect to try again. (${error})`);
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
      isReconnecting,
      gestureNames: device?.info.gesture_list ?? NO_GESTURES,
      connect,
      disconnect,
    }),
    [device, status, isConnecting, isReconnecting, connect, disconnect],
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
};
