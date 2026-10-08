import { signal } from "@preact/signals";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { keepSubscribed, trackPending } from "./sync";

test("trackPending counts a write until the server acknowledges it", async () => {
  const count = signal(0);
  let ack!: () => void;
  const write = trackPending(count, new Promise<void>((resolve) => (ack = resolve)));
  expect(count.value).toBe(1);
  ack();
  await write;
  expect(count.value).toBe(0);
});

test("trackPending stops counting a refused write and still reports the refusal", async () => {
  const count = signal(0);
  const write = trackPending(count, Promise.reject(new Error("permission-denied")));
  expect(count.value).toBe(1);
  await expect(write).rejects.toThrow("permission-denied");
  expect(count.value).toBe(0);
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A fake listener: records each subscription and lets the test fail the latest one. */
function fakeListener() {
  const fails: ((e: unknown) => void)[] = [];
  let active = 0;
  const subscribe = (fail: (e: unknown) => void) => {
    fails.push(fail);
    active++;
    return () => { active--; };
  };
  return { subscribe, fails, active: () => active };
}

test("keepSubscribed reports a failure and subscribes again after the delay", () => {
  const l = fakeListener();
  const onFail = vi.fn();
  keepSubscribed(l.subscribe, onFail, 30_000);
  expect(l.fails).toHaveLength(1);

  l.fails[0]!(new Error("permission-denied"));
  expect(onFail).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(29_999);
  expect(l.fails).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(l.fails).toHaveLength(2);
});

test("keepSubscribed stop unsubscribes and cancels a pending retry", () => {
  const l = fakeListener();
  const stop = keepSubscribed(l.subscribe, () => {}, 30_000);
  expect(l.active()).toBe(1);
  stop();
  expect(l.active()).toBe(0);

  const l2 = fakeListener();
  const stop2 = keepSubscribed(l2.subscribe, () => {}, 30_000);
  l2.fails[0]!(new Error("unavailable"));
  stop2();
  vi.advanceTimersByTime(60_000);
  expect(l2.fails).toHaveLength(1);
});
