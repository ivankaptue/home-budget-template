import type { Signal } from "@preact/signals";

/** Counts a write in `count` until the server acknowledges or refuses it. Firestore only reports pending writes on
 *  documents still in a snapshot, so a pending delete would otherwise be invisible. The write promise stays
 *  pending while offline. */
export function trackPending<T>(count: Signal<number>, write: Promise<T>): Promise<T> {
  count.value += 1;
  return write.finally(() => {
    count.value -= 1;
  });
}

/** Keeps a listener alive: a failed Firestore listener is dead for good, so report the failure and subscribe
 *  again after `delayMs` (e.g. rules that went live a few seconds after the app). Returns the stop function. */
export function keepSubscribed(
  subscribe: (fail: (e: unknown) => void) => () => void,
  onFail: (e: unknown) => void,
  delayMs: number,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe = () => {};
  const start = () => {
    unsubscribe = subscribe((e) => {
      onFail(e);
      if (!stopped) timer = setTimeout(start, delayMs);
    });
  };
  start();
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
  };
}
