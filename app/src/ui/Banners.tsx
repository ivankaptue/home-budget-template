import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { outflowSyncError, pendingCount, syncError, writeError } from "../data/store";

const online = signal(navigator.onLine);

export function OfflineBanner() {
  useEffect(() => {
    const up = () => (online.value = true);
    const down = () => (online.value = false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  const n = pendingCount.value;
  if (online.value && n === 0) return null;
  const waiting = n > 0 ? `${n} ${n > 1 ? "saisies" : "saisie"} en attente d’envoi` : "les saisies seront envoyées au retour du réseau";
  return <div class="banner offline" role="status">{online.value ? `Synchronisation · ${waiting}` : `Hors ligne · ${waiting}`}</div>;
}

export function ErrorBanner() {
  const msg = writeError.value ?? syncError.value ?? outflowSyncError.value;
  if (!msg) return null;
  return (
    <div class="banner error" role="alert">
      <span>{msg}</span>
      {writeError.value ? <button onClick={() => (writeError.value = null)}>OK</button> : null}
    </div>
  );
}
