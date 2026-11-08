"use client";

import { useState } from "react";
import { suggestPriceAction, type PriceSuggestion } from "@/app/actions/admin";
import type { Engine } from "@/lib/template-admin";

interface Analysis {
  titleMn: string;
  titleEn: string;
  descriptionMn: string;
  descriptionEn: string;
  peopleCount: number;
  generatedPrompt: string;
  requiredUploads: { personIndex: number; description: string }[];
}

/** Everything "Apply" copies into the template form. */
export interface AppliedSetup {
  name: string;
  description: string;
  nameMn: string;
  descriptionMn: string;
  prompt: string;
  photoCount: number;
  labels: string[];
  /** Present when a price could be worked out. */
  price: { credits: number; creditsHd: number | null; costUsd: number; costUsdHd: number | null } | null;
}

/** What the price lookup needs to know about the template being edited. */
export interface PriceContext {
  type: "VIDEO" | "IMAGE";
  imageResolution: string;
  imageQuality: string;
  imageAspect: string;
}

const ERRORS: Record<string, string> = {
  not_configured: "Gemini is not set up: add GEMINI_API_KEY on the server.",
  upload_first: "Upload the source video first (links to other sites can't be analyzed).",
  forbidden: "You are not allowed to do this.",
  analysis_failed: "Gemini could not analyze this video. Try again, or fill the fields by hand.",
};

const inputClass = "w-full rounded-lg border border-foreground/30 bg-transparent px-2 py-1 text-sm";
const labelClass = "mb-1 block text-xs font-semibold";
const credits = (n: number) => n.toLocaleString("en-US");

/**
 * "Analyze with Gemini" for the source video. Gemini watches it and suggests a short title and
 * description (Mongolian and English), the scene prompt, how many photos are needed and a label
 * for each; the credit price is worked out next to it from the real provider cost, aiming for
 * about 55% margin. Everything is editable here and is copied into the form only on Apply.
 */
export function VideoAnalysis({
  sourceVideoUrl,
  engine,
  priceContext,
  onApply,
}: {
  sourceVideoUrl: string;
  engine: Engine;
  priceContext: PriceContext;
  onApply: (result: AppliedSetup) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [price, setPrice] = useState<PriceSuggestion | null>(null);
  const [priceNote, setPriceNote] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function analyze() {
    setBusy(true);
    setError(null);
    setApplied(false);
    try {
      // The price lookup does not depend on what Gemini says, so both run at once.
      const [analysisRes, priceRes] = await Promise.allSettled([
        fetch("/api/admin/analyze-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceVideoUrl, engine }),
        }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(ERRORS[data.error] ?? "Could not analyze the video.");
          return data as Analysis;
        }),
        suggestPriceAction({
          engine,
          type: priceContext.type,
          videoResolution: "480p",
          sourceVideoUrl,
          prompt: "",
          imageResolution: priceContext.imageResolution,
          imageQuality: priceContext.imageQuality,
          imageAspect: priceContext.imageAspect,
        }),
      ]);

      if (analysisRes.status === "rejected") throw analysisRes.reason;
      setResult(analysisRes.value);

      if (priceRes.status === "fulfilled" && priceRes.value.ok) {
        setPrice(priceRes.value);
        setPriceNote(null);
      } else {
        setPrice(null);
        setPriceNote(
          priceRes.status === "fulfilled" && !priceRes.value.ok
            ? priceRes.value.error
            : "Could not work out a price. Set the credits by hand.",
        );
      }
    } catch (e) {
      setResult(null);
      setPrice(null);
      setError(e instanceof Error ? e.message : "Could not analyze the video.");
    } finally {
      setBusy(false);
    }
  }

  const update = (patch: Partial<Analysis>) => setResult((r) => (r ? { ...r, ...patch } : r));
  const setLabel = (index: number, description: string) =>
    setResult((r) =>
      r ? { ...r, requiredUploads: r.requiredUploads.map((u, i) => (i === index ? { ...u, description } : u)) } : r,
    );

  return (
    <div className="space-y-3 rounded-xl border border-foreground/20 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={busy}
          className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Gemini is watching the video…" : result ? "Analyze again" : "Analyze with Gemini"}
        </button>
        <span className="text-xs text-foreground/60">
          Writes the title and a very short description (Mongolian and English), the prompt and the photo labels, and
          suggests the credit price. This can take up to a minute.
        </span>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <p className="text-sm">
            <span className="rounded-full bg-foreground/10 px-3 py-1 font-semibold">
              {result.peopleCount} {result.peopleCount === 1 ? "person" : "people"} detected
            </span>
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div>
                <label className={labelClass}>Title (Монгол)</label>
                <input
                  value={result.titleMn}
                  onChange={(e) => update({ titleMn: e.target.value })}
                  maxLength={80}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Very short description (Монгол)</label>
                <input
                  value={result.descriptionMn}
                  onChange={(e) => update({ descriptionMn: e.target.value })}
                  maxLength={160}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <label className={labelClass}>Title (English)</label>
                <input
                  value={result.titleEn}
                  onChange={(e) => update({ titleEn: e.target.value })}
                  maxLength={80}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Very short description (English)</label>
                <input
                  value={result.descriptionEn}
                  onChange={(e) => update({ descriptionEn: e.target.value })}
                  maxLength={160}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Suggested prompt (users never see it)</label>
            <textarea
              value={result.generatedPrompt}
              onChange={(e) => update({ generatedPrompt: e.target.value })}
              rows={4}
              maxLength={5000}
              className={`${inputClass} font-mono`}
            />
          </div>

          <div>
            <p className={labelClass}>What users will see under each upload box</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {result.requiredUploads.map((u, i) => (
                <div key={u.personIndex} className="rounded-xl border border-foreground/15 p-2">
                  <div className="mb-1 text-[11px] text-foreground/60">Photo {i + 1}</div>
                  <input
                    value={u.description}
                    onChange={(e) => setLabel(i, e.target.value)}
                    maxLength={60}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-foreground/15 p-3 text-sm">
            <p className={labelClass}>Suggested price</p>
            {price ? (
              <div className="space-y-1">
                <p>
                  <span className="font-semibold">{credits(price.credits)} credits</span> at 480p
                  {price.creditsHd !== null && (
                    <>
                      {" · "}
                      <span className="font-semibold">{credits(price.creditsHd)} credits</span> at 720p HD
                    </>
                  )}
                </p>
                <p className="text-xs text-foreground/60">
                  Aims for about {price.targetPct}% margin on the {price.reference}; the packs end up at{" "}
                  {price.margins.map((m) => `${m.name} ${m.pct.toFixed(0)}%`).join(", ")}. Provider cost ≈ $
                  {price.costUsd.toFixed(2)}
                  {price.costUsdHd !== null ? ` (480p) / $${price.costUsdHd.toFixed(2)} (720p)` : ""}; payment fees and
                  free signup credits are not included.
                </p>
              </div>
            ) : (
              <p className="text-xs text-foreground/60">{priceNote ?? "No price suggestion."}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onApply({
                name: result.titleEn.trim(),
                description: result.descriptionEn.trim(),
                nameMn: result.titleMn.trim(),
                descriptionMn: result.descriptionMn.trim(),
                prompt: result.generatedPrompt,
                photoCount: result.peopleCount,
                labels: result.requiredUploads.map((u) => u.description.trim()),
                price: price
                  ? { credits: price.credits, creditsHd: price.creditsHd, costUsd: price.costUsd, costUsdHd: price.costUsdHd }
                  : null,
              });
              setApplied(true);
            }}
            className="btn-primary px-5 py-2 text-sm font-semibold"
          >
            Apply to this template
          </button>
          {applied && (
            <p className="text-xs text-foreground/70">
              Applied: the titles, descriptions, prompt, number of photos, photo labels
              {price ? " and credit prices" : ""} below were replaced. Review them, then save.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
