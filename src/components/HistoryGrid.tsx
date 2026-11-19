"use client";

import Link from "next/link";
import { SaveButton } from "@/components/SaveButton";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { LazyVideo } from "@/components/LazyVideo";
import { Reveal } from "@/components/Reveal";
import { formatCredits } from "@/config/pricing";

export interface HistoryItem {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  type: "IMAGE" | "VIDEO";
  templateId: string;
  templateName: string;
  /** Pre-formatted date. */
  date: string;
  credits: number;
  durationSeconds: number | null;
  aspect: string;
}

/** "9:16" -> "9 / 16" for the CSS aspect-ratio property; falls back to 3/4. */
function aspectCss(ratio: string) {
  const [w, h] = ratio.split(":").map(Number);
  return w > 0 && h > 0 ? `${w} / ${h}` : "3 / 4";
}

/**
 * The history cards with their delete actions: one item at a time, or "Select" for checkboxes and a bottom bar
 * that deletes many (up to 100 per request). Deleting always asks first, and the item leaves the list at once.
 */
export function HistoryGrid({ items }: { items: HistoryItem[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<string[] | null>(null); // ids waiting for the confirmation
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [gone, setGone] = useState<string[]>([]);

  const visible = items.filter((i) => !gone.includes(i.id));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function confirmDelete() {
    if (!pending) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/history/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pending }),
      });
      if (!res.ok) throw new Error("failed");
      // Gone from the list at once; the refresh brings the next items and the new counts.
      setGone((g) => [...g, ...pending]);
      setSelected((s) => s.filter((id) => !pending.includes(id)));
      setPending(null);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          aria-pressed={selecting}
          onClick={() => {
            setSelecting((s) => !s);
            setSelected([]);
          }}
          className="btn-glass btn-compact"
        >
          {selecting ? t("history.cancelSelect") : t("history.select")}
        </button>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-4 pb-24 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((g, index) => {
          const on = selected.includes(g.id);
          const done = g.status === "COMPLETED" || g.status === "FAILED";
          return (
            <li key={g.id}>
              <Reveal delay={Math.min(index, 7) * 60}>
                <div className={`rounded-2xl border bg-surface p-2 shadow-lg shadow-black/20 ${on ? "border-brand" : "border-line"}`}>
                  <div className="relative overflow-hidden rounded-xl bg-foreground/10" style={{ aspectRatio: aspectCss(g.aspect) }}>
                    {g.status === "COMPLETED" && g.type === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/generations/${g.id}/video`} alt={g.templateName} loading="lazy" className="h-full w-full object-cover" />
                    ) : g.status === "COMPLETED" ? (
                      <LazyVideo src={`/api/generations/${g.id}/video`} label={g.templateName} controls fill />
                    ) : (
                      <div className="flex h-full items-center justify-center p-3 text-center text-sm text-muted">
                        {g.status === "FAILED" ? t("history.failed") : t("history.creating")}
                      </div>
                    )}
                    <span className="chip-glass absolute left-2 top-2 flex items-center gap-1 bg-black/55 px-2 py-0.5 text-[11px] backdrop-blur">
                      {g.type === "VIDEO" && (
                        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-3">
                          <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z" />
                        </svg>
                      )}
                      {g.type === "VIDEO" ? t("gen.video") : t("gen.image")}
                      {g.type === "VIDEO" && g.durationSeconds ? ` · ${t("gen.secondsShort", { n: g.durationSeconds })}` : ""}
                    </span>
                    {/* Round icon buttons on the picture's top-right corner (clear of video controls): save and delete.
                        While selecting, the corner holds the checkbox instead. */}
                    {done && !selecting && (
                      <div className="absolute right-2 top-2 flex gap-1.5">
                      {g.status === "COMPLETED" && (
                        <SaveButton href={`/api/generations/${g.id}/video?download=1`} label={t("history.download")} iconOnly />
                      )}
                      {done && !selecting && (
                        <button
                          type="button"
                          onClick={() => setPending([g.id])}
                          aria-label={`${t("history.delete")}: ${g.templateName}`}
                          title={t("history.delete")}
                          className="grid size-9 shrink-0 place-items-center rounded-full border border-danger/50 bg-black/60 text-red-300 backdrop-blur transition hover:bg-danger/40"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 7h16M10 11v6M14 11v6" />
                            <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                          </svg>
                        </button>
                      )}
                      </div>
                    )}
                    {selecting && done && (
                      <label className="absolute right-2 top-2 flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/60">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(g.id)}
                          aria-label={t("history.select")}
                          className="size-5 accent-[var(--brand)]"
                        />
                      </label>
                    )}
                  </div>
                  {/* Name, date and credits, full width; the save and delete icons sit on the picture. */}
                  <div className="mt-2 px-1 pb-1">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{g.templateName}</div>
                      <div className="truncate text-xs text-muted">
                        {g.date} · {t("history.credits", { n: formatCredits(g.credits) })}
                      </div>
                    </div>
                  </div>
                  {g.status !== "COMPLETED" && (
                    <div className="mt-1 flex px-1 pb-1">
                      {g.status === "FAILED" ? (
                        <Link href={`/templates/${g.templateId}`} className="btn-glass btn-compact flex-1">
                          {t("history.tryAgain")}
                        </Link>
                      ) : (
                        <Link href={`/templates/${g.templateId}?g=${g.id}`} className="btn-glass btn-compact flex-1">
                          {t("history.viewProgress")}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </Reveal>
            </li>
          );
        })}
      </ul>

      {selecting && selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-[rgba(10,14,34,0.85)] px-5 py-3 backdrop-blur-xl [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="font-semibold">{t("history.selected", { n: selected.length })}</span>
          <button type="button" onClick={() => setPending(selected)} className="btn-danger">
            {t("history.delete")}
          </button>
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation" onClick={() => !busy && setPending(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("history.delete")}
            lang={locale}
            onClick={(e) => e.stopPropagation()}
            className="animate-pop-in w-full max-w-sm rounded-3xl border border-line bg-[rgba(10,14,34,0.95)] p-6 shadow-[0_0_60px_rgba(47,91,255,0.2)] backdrop-blur-xl"
          >
            <p className="text-[15px] leading-relaxed">
              {pending.length === 1 ? t("history.deleteConfirm") : t("history.deleteConfirmMany", { n: pending.length })}
            </p>
            {error && <p className="mt-3 text-sm text-danger">{t("history.deleteError")}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" disabled={busy} onClick={() => setPending(null)} className="btn-glass flex-1">
                {t("history.deleteCancel")}
              </button>
              <button type="button" disabled={busy} onClick={() => void confirmDelete()} className="btn-danger flex-1">
                {busy ? t("history.deleting") : t("history.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
