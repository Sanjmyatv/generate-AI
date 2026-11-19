"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Shrinks the heavy video previews one after another (360 px wide, no sound, about half a megabyte each, with a
 * thumbnail). Each one is saved as soon as it is done, so it is safe to stop part-way and run it again.
 */
export function ShrinkPreviews({ templates }: { templates: { id: string; name: string }[] }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; done: number; failed: string[]; savedMb: number }>({
    busy: false,
    done: 0,
    failed: [],
    savedMb: 0,
  });

  async function run() {
    setState({ busy: true, done: 0, failed: [], savedMb: 0 });
    let done = 0;
    let saved = 0;
    const failed: string[] = [];
    for (const t of templates) {
      try {
        const res = await fetch("/api/admin/optimize-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: t.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "failed");
        saved += (data.beforeBytes - data.afterBytes) / 1024 / 1024;
      } catch {
        failed.push(t.name);
      }
      done++;
      setState({ busy: true, done, failed: [...failed], savedMb: saved });
    }
    setState({ busy: false, done, failed, savedMb: saved });
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-500/50 p-3 text-sm">
      <p className="font-semibold">
        {templates.length} preview{templates.length === 1 ? " is" : "s are"} heavy or have no thumbnail
      </p>
      <p className="mt-1 text-xs text-foreground/60">
        Visitors download these on their phones. Shrinking makes every preview the same small size (360 px wide, no sound, about
        half a megabyte) and makes a thumbnail. It takes a few seconds per video.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" disabled={state.busy} onClick={() => void run()} className="btn-primary btn-compact disabled:opacity-50">
          {state.busy ? `Shrinking ${state.done + 1} of ${templates.length}…` : "Shrink all"}
        </button>
        {!state.busy && state.done > 0 && (
          <span className="text-xs">
            Done: {state.done - state.failed.length} shrunk, {state.savedMb.toFixed(1)} MB saved
            {state.failed.length > 0 ? `. Could not shrink: ${state.failed.join(", ")}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
