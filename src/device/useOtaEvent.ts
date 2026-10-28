import { useEffect, useEffectEvent } from "react";
import { on, type OtaEvents } from "./ota";

/**
 * Subscribe to a device event for the lifetime of the component. The handler
 * always sees the latest props/state without re-subscribing.
 */
export function useOtaEvent<K extends keyof OtaEvents>(
  type: K,
  handler: (payload: OtaEvents[K]) => void,
) {
  const onEvent = useEffectEvent(handler);
  useEffect(() => on(type, (payload) => onEvent(payload)), [type]);
}
