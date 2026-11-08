"use client";

import { useState } from "react";
import type { Engine } from "@/lib/template-admin";

interface Analysis {
  peopleCount: number;
  generatedPrompt: string;
  requiredUploads: { personIndex: number; description: string }[];
}

const ERRORS: Record<string, string> = {
  not_configured: "Gemini is not set up: add GEMINI_API_KEY on the server.",
  upload_first: "Upload the source video first (links to other sites can't be analyzed).",
  forbidden: "You are not allowed to do this.",
  analysis_failed: "Gemini could not analyze this video. Try again, or fill the fields by hand.",
};

/**
 * "Analyze with Gemini" for the source video: shows how many people it found, the scene prompt
 * and the instruction under each upload box, all editable, and copies them into the template
 * form only when the admin presses Apply.
 */
export function VideoAnalysis({
  sourceVideoUrl,
  engine,
  onApply,
}: {
  sourceVideoUrl: string;
  engine: Engine;
  onApply: (result: { prompt: string; photoCount: number; labels: string[] }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [applied, setApplied] = useState(false);

  async function analyze() {
    setBusy(true);
    setError(null);
    setApplied(false);
    try {
      const res = await fetch("/api/admin/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceVideoUrl, engine }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(ERRORS[data.error] ?? "Could not analyze the video.");
      setResult(data as Analysis);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Could not analyze the video.");
    } finally {
      setBusy(false);
    }
  }

  const setPrompt = (generatedPrompt: string) => setResult((r) => (r ? { ...r, generatedPrompt } : r));
  const setLabel = (index: number, description: string) =>
    setResult((r) =>
      r ? { ...r, requiredUploads: r.requiredUploads.map((u, i) => (i === index ? { ...u, description } : u)) } : r,
    );

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-foreground/20 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={busy}
          className="rounded-full border border-foreground/40 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Gemini is watching the video…" : result ? "Analyze again" : "Analyze with Gemini"}
        </button>
        <span className="text-xs text-foreground/60">
          Suggests the number of photos, the prompt and the upload instructions. This can take up to a minute.
        </span>
      </div>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}

      {result && (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="rounded-full bg-foreground/10 px-3 py-1 font-semibold">
              {result.peopleCount} {result.peopleCount === 1 ? "person" : "people"} detected
            </span>
          </p>

          <div>
            <label className="mb-1 block text-xs font-semibold">Suggested prompt (users never see it)</label>
            <textarea
              value={result.generatedPrompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              maxLength={5000}
              className="w-full rounded-xl border border-foreground/30 bg-transparent px-3 py-2 font-mono text-sm"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold">What users will see under each upload box</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {result.requiredUploads.map((u, i) => (
                <div key={u.personIndex} className="rounded-xl border border-foreground/15 p-3">
                  <div className="mb-1 flex size-16 items-center justify-center rounded-lg bg-foreground/10 text-xs text-foreground/60">
                    Photo {i + 1}
                  </div>
                  <input
                    value={u.description}
                    onChange={(e) => setLabel(i, e.target.value)}
                    maxLength={60}
                    className="w-full rounded-lg border border-foreground/30 bg-transparent px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onApply({
                prompt: result.generatedPrompt,
                photoCount: result.peopleCount,
                labels: result.requiredUploads.map((u) => u.description.trim()),
              });
              setApplied(true);
            }}
            className="btn-primary rounded-full px-5 py-2 text-sm font-semibold"
          >
            Apply to this template
          </button>
          {applied && (
            <p className="text-xs text-foreground/70">
              Applied: the prompt, the number of photos and the photo labels below were replaced. Review them, then save.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
