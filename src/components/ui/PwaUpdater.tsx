// PwaUpdater.tsx — Registers the service worker (vite-plugin-pwa) that lets
// MyCato be installed and run offline, and offers new versions as they ship.
//
// A new version waits for the user's "Reload" rather than applying itself:
// reloading drops the WebHID connection, which mustn't happen mid-edit.

import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { notify } from "../../lib/notify";

// How often an open window checks for a new deploy (the browser also checks
// on every navigation).
const UPDATE_CHECK_MS = 60 * 60 * 1000;

const PwaUpdater = () => {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => {}); // offline: try again next time
      }, UPDATE_CHECK_MS);
    },
    onRegisterError(err) {
      console.error("PWA: service worker registration failed", err);
    },
  });

  useEffect(() => {
    if (offlineReady) notify.success("MyCato is ready to work offline.");
  }, [offlineReady]);

  useEffect(() => {
    if (!needRefresh) return;
    notify.info("A new version of MyCato is available. Reloading disconnects Cato; reconnect afterwards.", {
      persist: true,
      action: { label: "Reload", onClick: () => updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
};

export default PwaUpdater;
