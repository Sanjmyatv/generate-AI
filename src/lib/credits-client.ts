"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The signed-in user's credit balance in the browser, shared by everything that shows it (the header, the generate
 * page), so a charge, a refund or a top-up shows everywhere at once without reloading the page.
 *
 * Each page render hands in the balance the server read (`useLiveCredits(server)`), which becomes the value; after
 * that, `adjustCredits` moves it right away and `refreshCredits` asks the server for the exact figure.
 */
let value: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setCredits(next: number | null) {
  if (next === value) return;
  value = next;
  emit();
}

/** Moves the balance at once (a charge is negative), before the server confirms it. */
export function adjustCredits(delta: number) {
  if (value !== null) setCredits(Math.max(0, value + delta));
}

/** Reads the exact balance from the server. Safe to call often; failures leave the current value. */
export async function refreshCredits() {
  try {
    const res = await fetch("/api/credits", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { credits: number | null };
    if (typeof data.credits === "number") setCredits(data.credits);
  } catch {
    /* offline: keep what we have */
  }
}

/** The live balance; `server` is the figure this render got from the server (null for guests). */
export function useLiveCredits(server: number | null) {
  useEffect(() => setCredits(server), [server]);
  const live = useSyncExternalStore(subscribe, () => value, () => null);
  return server === null ? null : (live ?? server);
}

/** Keeps the balance exact while the tab is open: re-read whenever the visitor comes back to it. */
export function useCreditsOnFocus(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => document.visibilityState === "visible" && void refreshCredits();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}
