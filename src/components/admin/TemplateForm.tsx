"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { saveTemplateAction, suggestPriceAction, type TemplateFormState } from "@/app/actions/admin";
import { CostMargin } from "@/components/admin/CostMargin";
import { VideoAnalysis } from "@/components/admin/VideoAnalysis";
import { TemplatePreview } from "@/components/TemplatePreview";
import { RESOLUTIONS } from "@/config/pricing";
import type { PackagePrice } from "@/lib/pricing";
import {
  CARD_SHAPES,
  ENGINES,
  IMAGE_ASPECTS,
  IMAGE_QUALITIES,
  IMAGE_RESOLUTIONS,
  MAX_PHOTOS,
  VIDEO_RATIOS,
  hasPriceLookup,
  isGenjutsuEngine,
  type Engine,
  type TemplateFormValues,
} from "@/lib/template-admin";

const initialState: TemplateFormState = { errors: {}, message: null };

/** Genjutsu list price per second of source video, before the account's discount. */
const GENJUTSU_RATE: Record<string, number> = { "480p": 0.318, "720p": 0.681, "1080p": 1.632 };

/** Genjutsu Light list price per second, counted over the output plus the source video. */
const GENJUTSU_LIGHT_RATE: Record<string, number> = { "480p": 0.05, "720p": 0.1, "1080p": 0.2 };
const GENJUTSU_LIGHT_MAX_SECONDS = 15;

const GENJUTSU_PROMPT_HELP =
  'Optional. Say who replaces whom, e.g. "Replace the dancer with the person in the first reference image." Refer to the photos as the first, second, third reference image.';

const PROMPT_HELP: Record<Engine, string> = {
  genjutsu: GENJUTSU_PROMPT_HELP,
  "genjutsu-light": GENJUTSU_PROMPT_HELP,
  "seedance-edit": 'Refer to the photos as "Image 1", "Image 2"… and to the source video as "Video 1".',
  "seedance-reference": 'Describe the scene, the action and the look. Refer to the photos as "Image 1", "Image 2"…',
  "marketing-image":
    "Describe the edit you want. The user's photo is sent as the reference image, so say what to keep (faces, composition) and what to change.",

};

const inputClass = "w-full rounded-xl border border-foreground/30 bg-transparent px-3 py-2";
const labelClass = "mb-1 block text-sm font-semibold";

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-foreground/60">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-foreground/15 p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

interface UploadState {
  busy: boolean;
  error: string | null;
}

const UPLOAD_ERRORS: Record<string, string> = {
  too_large: "That file is too large.",
  unsupported_type: "Use an MP4/MOV/WebM video or a JPG/PNG/WebP image.",
  source_must_be_mp4: "The source video must be an MP4 or MOV file.",
  source_too_short: "The source video must be at least 4 seconds long.",
  forbidden: "You are not allowed to upload.",
};

export function TemplateForm({
  initial,
  categories,
  packages,
  usdMnt,
  templateId,
}: {
  initial: TemplateFormValues;
  categories: { id: string; name: string }[];
  /** Credit packs, used to work out what a credit earns. */
  packages: PackagePrice[];
  /** Default exchange rate (₮ per $1) for the cost box. */
  usdMnt: number;
  templateId?: string;
}) {
  const [v, setV] = useState(initial);
  const [state, formAction, pending] = useActionState(saveTemplateAction, initialState);
  const [previewUpload, setPreviewUpload] = useState<UploadState>({ busy: false, error: null });
  const [sourceUpload, setSourceUpload] = useState<UploadState>({ busy: false, error: null });
  const [sourceSeconds, setSourceSeconds] = useState<number | null>(null);
  // New templates are priced automatically; an existing one keeps its price until the admin asks.
  const [autoPrice, setAutoPrice] = useState(!templateId);
  const [priceStatus, setPriceStatus] = useState<{ error: boolean; note: string | null }>({ error: false, note: null });

  const set = <K extends keyof TemplateFormValues>(key: K, value: TemplateFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));
  const text = (key: keyof TemplateFormValues) => ({
    name: key,
    value: String(v[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(key, e.target.value as never),
  });

  // One label field per photo; the labels travel as one newline-separated string.
  const photoCount = Math.min(Math.max(Math.trunc(Number(v.requiredPhotoCount)) || 1, 1), MAX_PHOTOS);
  const labels = Array.from({ length: photoCount }, (_, i) => v.photoLabels.split("\n")[i] ?? "");
  const setLabel = (index: number, value: string) =>
    set("photoLabels", labels.map((label, i) => (i === index ? value : label)).join("\n"));

  const err = state.errors;
  const needsVideo = isGenjutsuEngine(v.engine) || v.engine === "seedance-edit";
  const engines = ENGINES.filter((e) => e.type === v.type);

  async function upload(file: File, purpose: "preview" | "source") {
    const setState = purpose === "preview" ? setPreviewUpload : setSourceUpload;
    setState({ busy: true, error: null });
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("purpose", purpose);
      const res = await fetch("/api/admin/assets", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(UPLOAD_ERRORS[data.error] ?? "Upload failed. Try again.");
      if (purpose === "preview") set("previewUrl", data.url);
      else {
        set("sourceVideoUrl", data.url);
        setSourceSeconds(typeof data.duration === "number" ? data.duration : null);
        // The uploaded video's length is the template's length (it picks the price tier).
        if (typeof data.duration === "number") set("durationSeconds", String(Math.round(data.duration)));
      }
      setState({ busy: false, error: null });
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : "Upload failed." });
    }
  }

  // Light bills the output plus the source video, and only uses the first 15 s of it.
  const lightSeconds = sourceSeconds === null ? 0 : Math.ceil(Math.min(sourceSeconds, GENJUTSU_LIGHT_MAX_SECONDS)) * 2;
  const estimates =
    sourceSeconds === null
      ? null
      : v.engine === "genjutsu"
        ? RESOLUTIONS.map((r) => ({ r, usd: Math.ceil(sourceSeconds) * (GENJUTSU_RATE[r] ?? 0) }))
        : v.engine === "genjutsu-light"
          ? RESOLUTIONS.map((r) => ({ r, usd: lightSeconds * (GENJUTSU_LIGHT_RATE[r] ?? 0) }))
          : null;

  // The credits follow the method, the source video, the image quality and, for video, both qualities (480p and 720p).
  // Only methods without a price API (Seedance) need the provider cost typed in.
  const hasLookup = hasPriceLookup(v.engine);
  const typedCost = hasLookup ? "" : v.costUsd;
  const typedCostHd = hasLookup ? "" : v.costUsdHd;
  useEffect(() => {
    if (!autoPrice) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (hasLookup && needsVideo && !v.sourceVideoUrl) {
        setPriceStatus({ error: false, note: "Upload the source video and the price is worked out for you." });
        return;
      }
      setPriceStatus({ error: false, note: "Working out the price…" });
      let result;
      try {
        result = await suggestPriceAction({
          engine: v.engine,
          type: v.type,
          videoResolution: "480p",
          sourceVideoUrl: v.sourceVideoUrl,
          prompt: "",
          imageResolution: "2k",
          imageQuality: v.imageQuality,
          imageAspect: v.imageAspect,
          manualCostUsd: Number(typedCost) || undefined,
          manualCostUsdHd: Number(typedCostHd) || undefined,
        });
      } catch {
        result = { ok: false as const, error: "Could not work out the price. Turn off “automatically” to set it by hand." };
      }
      if (cancelled) return;
      if (!result.ok) {
        setPriceStatus({ error: true, note: result.error });
        return;
      }
      if (result.imageTiers) {
        const { credits, costUsd } = result.imageTiers;
        setV((prev) => ({
          ...prev,
          creditCost: String(credits["1k"]),
          creditCost2k: String(credits["2k"]),
          creditCost4k: String(credits["4k"]),
          costUsd: String(costUsd["1k"]),
          costUsd2k: String(costUsd["2k"]),
          costUsd4k: String(costUsd["4k"]),
        }));
      } else setV((prev) => ({
        ...prev,
        creditCost: String(result.credits),
        // Looked-up costs fill the cost boxes; typed ones stay as typed. A missing HD price means 480p only.
        creditCostHd: result.creditsHd !== null ? String(result.creditsHd) : hasLookup ? prev.creditCostHd : "",
        ...(hasLookup
          ? { costUsd: String(result.costUsd), costUsdHd: result.costUsdHd !== null ? String(result.costUsdHd) : prev.costUsdHd }
          : {}),
      }));
      setPriceStatus({
        error: false,
        note: `About ${result.targetPct}% margin on the ${result.reference}. Packs: ${result.margins
          .map((m) => `${m.name} ${m.pct.toFixed(0)}%`)
          .join(", ")}.${result.note ? ` ${result.note}` : ""}`,
      });
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [autoPrice, hasLookup, needsVideo, typedCost, typedCostHd, v.engine, v.type, v.sourceVideoUrl, v.imageQuality, v.imageAspect]);

  // Switching between a method with a price lookup and one without makes the old cost meaningless.
  function chooseEngine(next: Engine, type: TemplateFormValues["type"] = v.type) {
    setV((prev) => ({
      ...prev,
      type,
      engine: next,
      ...(hasPriceLookup(prev.engine) !== hasPriceLookup(next) ? { costUsd: "", costUsdHd: "" } : {}),
    }));
  }

  return (
    <form
      onSubmit={(e) => {
        // Submit by hand so React doesn't clear the fields when the action reports an error.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="mx-auto max-w-2xl space-y-6 py-6"
    >
      {templateId && <input type="hidden" name="templateId" value={templateId} />}
      <input type="hidden" name="previewUrl" value={v.previewUrl} />
      <input type="hidden" name="sourceVideoUrl" value={v.sourceVideoUrl} />

      {needsVideo && (
        <Section title="Source video">
            <Field label="Template video" error={err.sourceVideoUrl || sourceUpload.error || undefined} hint={
                v.sourceVideoUrl
                  ? "Choose a new file to replace this video."
                  : "Upload an MP4 or MOV, at least 4 seconds long (up to 30 seconds is used)."
              }>
              <input
                type="file"
                accept="video/mp4,video/quicktime"
                disabled={sourceUpload.busy}
                onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0], "source")}
                className="block w-full text-sm"
              />
              {sourceUpload.busy && <p className="mt-1 text-xs">Uploading…</p>}
              {v.sourceVideoUrl && (
                <div className="mt-2 flex items-start gap-3">
                  <video src={v.sourceVideoUrl} controls muted playsInline className="h-40 rounded-lg bg-black" />
                  <div className="text-xs text-foreground/70">
                    {sourceSeconds !== null && <p>Length: {sourceSeconds.toFixed(1)} s</p>}
                    {estimates && (
                      <p>
                        {v.engine === "genjutsu-light" ? "Genjutsu Light" : "Genjutsu"} list price per generation:{" "}
                        {estimates.map((e) => `${e.r} ≈ ${e.usd.toFixed(2)}`).join(", ")} (your account discount
                        applies on top). Check the real cost under Photos and price.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Field>
          {v.sourceVideoUrl && (
            <VideoAnalysis
              sourceVideoUrl={v.sourceVideoUrl}
              engine={v.engine}
              priceContext={{ type: v.type, imageResolution: v.imageResolution, imageQuality: v.imageQuality, imageAspect: v.imageAspect }}
              onApply={(setup) =>
                setV((prev) => ({
                  ...prev,
                  name: setup.name || prev.name,
                  description: setup.description || prev.description,
                  nameMn: setup.nameMn || prev.nameMn,
                  descriptionMn: setup.descriptionMn || prev.descriptionMn,
                  prompt: setup.prompt,
                  requiredPhotoCount: String(setup.photoCount),
                  photoLabels: setup.labels.join("\n"),
                  ...(setup.price
                    ? {
                        creditCost: String(setup.price.credits),
                        creditCostHd: setup.price.creditsHd === null ? prev.creditCostHd : String(setup.price.creditsHd),
                        costUsd: String(setup.price.costUsd),
                        costUsdHd: setup.price.costUsdHd === null ? prev.costUsdHd : String(setup.price.costUsdHd),
                      }
                    : {}),
                }))
              }
            />
          )}
        </Section>
      )}

      <Section title="Basics">
        <Field label="Name" error={err.name}>
          <input {...text("name")} maxLength={80} className={inputClass} />
        </Field>
        <Field label="Description" error={err.description} hint="Shown under the template name.">
          <textarea {...text("description")} rows={2} maxLength={500} className={inputClass} />
        </Field>
        <div className="grid gap-4 rounded-xl border border-foreground/15 p-3">
          <p className="text-xs text-foreground/60">
            Mongolian version (optional). Visitors browsing in Mongolian see these; if left empty they see the English name
            and description above.
          </p>
          <Field label="Name (Монгол)" error={err.nameMn}>
            <input {...text("nameMn")} maxLength={80} className={inputClass} />
          </Field>
          <Field label="Description (Монгол)" error={err.descriptionMn}>
            <textarea {...text("descriptionMn")} rows={2} maxLength={500} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category" error={err.categoryId}>
            <select {...text("categoryId")} className={inputClass}>
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="…or a new category" error={err.newCategory}>
            <input {...text("newCategory")} maxLength={40} placeholder="e.g. Fashion" className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Card shape" error={err.aspectRatio}>
            <select {...text("aspectRatio")} className={inputClass}>
              {CARD_SHAPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Trending order" error={err.trendingRank} hint="Empty = not in Trending. 0 comes first.">
            <input {...text("trendingRank")} inputMode="numeric" className={inputClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            checked={v.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Visible on the site
        </label>
      </Section>

      <Section title="Content">
        <div>
          <span className={labelClass}>Output</span>
          <div className="flex gap-2">
            {(["VIDEO", "IMAGE"] as const).map((t) => (
              <label
                key={t}
                className={`flex-1 cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-semibold ${
                  v.type === t ? "btn-primary text-foreground" : "border-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={v.type === t}
                  onChange={() => {
                    chooseEngine(ENGINES.find((e) => e.type === t)!.value, t);
                  }}
                  className="sr-only"
                />
                {t === "VIDEO" ? "Video" : "Image"}
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>Method</span>
          <div className="space-y-2">
            {engines.map((e) => (
              <label key={e.value} className="flex cursor-pointer gap-2 rounded-xl border border-foreground/20 p-3 text-sm">
                <input
                  type="radio"
                  name="engine"
                  value={e.value}
                  checked={v.engine === e.value}
                  onChange={() => chooseEngine(e.value)}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold">{e.label}</span>
                  <span className="block text-xs text-foreground/60">{e.help}</span>
                </span>
              </label>
            ))}
          </div>
          {err.engine && <p className="mt-1 text-xs text-red-500">{err.engine}</p>}
        </div>

        <Field label="Prompt" error={err.prompt} hint={PROMPT_HELP[v.engine]}>
          <textarea {...text("prompt")} rows={7} maxLength={5000} className={`${inputClass} font-mono text-sm`} />
          <p className="mt-1 text-xs text-foreground/50">Users never see this prompt.</p>
        </Field>

        <Field label="Preview" error={err.previewUrl || previewUpload.error || undefined} hint="Shown on the template card and page. A short video or an image.">
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
            disabled={previewUpload.busy}
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0], "preview")}
            className="block w-full text-sm"
          />
          {previewUpload.busy && <p className="mt-1 text-xs">Uploading…</p>}
          {v.previewUrl && (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-40 w-24 overflow-hidden rounded-lg">
                <TemplatePreview src={v.previewUrl} alt="Preview" className="h-full w-full" />
              </div>
              <button type="button" onClick={() => set("previewUrl", "")} className="text-xs text-foreground/60 underline">
                Remove
              </button>
            </div>
          )}
        </Field>
      </Section>

      <Section title="Quality">
        {v.type === "IMAGE" ? (
          <div className="grid grid-cols-3 gap-4">
            <Field label="Resolution" error={err.imageResolution}>
              <select {...text("imageResolution")} className={inputClass}>
                {IMAGE_RESOLUTIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            {(
              <Field label="Quality" error={err.imageQuality}>
                <select {...text("imageQuality")} className={inputClass}>
                  {IMAGE_QUALITIES.map((q) => (
                    <option key={q}>{q}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Aspect ratio" error={err.imageAspect} hint="auto keeps the photo's shape.">
              <select {...text("imageAspect")} className={inputClass}>
                {IMAGE_ASPECTS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <>
            {/* Users pick 480p (default) or 720p HD themselves; this is the fallback stored with the template. */}
            <input type="hidden" name="videoResolution" value={v.videoResolution} />
            <p className="text-sm">
              Users choose <b>480p</b> (default, fast and eco) or <b>720p HD</b> when they generate. Set the credits
              for each under Photos and price; leave 720p empty to offer 480p only.
            </p>
            {v.engine === "seedance-reference" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Length (s)" error={err.duration}>
                  <input {...text("duration")} inputMode="numeric" className={inputClass} />
                </Field>
                <Field label="Video ratio" error={err.ratio}>
                  <select {...text("ratio")} className={inputClass}>
                    {VIDEO_RATIOS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            {!isGenjutsuEngine(v.engine) && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="generateAudio"
                  checked={v.generateAudio}
                  onChange={(e) => set("generateAudio", e.target.checked)}
                />
                Generate sound
              </label>
            )}
          </>
        )}
      </Section>

      <Section title="Photos and price">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Photos the user uploads" error={err.requiredPhotoCount} hint={`1 to ${MAX_PHOTOS}.`}>
            <input {...text("requiredPhotoCount")} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label="Photo type">
            <select {...text("photoRequirement")} className={inputClass}>
              <option value="FACE">Clear face</option>
              <option value="FULL_BODY">Full body</option>
            </select>
          </Field>
        </div>
        <Field
          label="Photo labels"
          error={err.photoLabels}
          hint="Name each photo slot, for example “Dancer on the left”. Shown under that upload slot. Leave one empty to show “Photo N”."
        >
          <input type="hidden" name="photoLabels" value={v.photoLabels} />
          <div className="space-y-2">
            {Array.from({ length: photoCount }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-foreground/60">Photo {i + 1}</span>
                <input
                  value={labels[i]}
                  onChange={(e) => setLabel(i, e.target.value)}
                  maxLength={60}
                  placeholder={photoCount > 1 ? `Photo ${i + 1}` : "Your photo"}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </Field>
        <div className="space-y-3 rounded-xl border border-foreground/20 p-3">
          <span className="text-sm font-semibold">Credits per generation</span>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoPrice}
              onChange={(e) => setAutoPrice(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">Work out the credits automatically</span>
              <span className="block text-xs text-foreground/60">
                Follows the method you choose and, for video, the quality (480p and 720p each get their own price).
                Aims for about 55% margin.
              </span>
            </span>
          </label>
          {autoPrice && priceStatus.note && (
            <p className={`text-xs ${priceStatus.error ? "text-red-500" : "text-foreground/70"}`}>{priceStatus.note}</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {v.type === "VIDEO" && (
              <Field label="Video length (s)" error={err.durationSeconds}>
                <input {...text("durationSeconds")} inputMode="numeric" className={inputClass} />
              </Field>
            )}
            <Field label={v.type === "VIDEO" ? "Credits at 480p" : "Credits at 1K"} error={err.creditCost}>
              <input {...text("creditCost")} inputMode="numeric" readOnly={autoPrice} className={`${inputClass} ${autoPrice ? "opacity-70" : ""}`} />
            </Field>
            {v.type === "VIDEO" ? (
              <Field label="Credits at 720p HD" error={err.creditCostHd} hint="Empty = 480p only.">
                <input {...text("creditCostHd")} inputMode="numeric" readOnly={autoPrice} className={`${inputClass} ${autoPrice ? "opacity-70" : ""}`} />
              </Field>
            ) : (
              <>
                <Field label="Credits at 2K (HD)" error={err.creditCost2k} hint="Empty = not offered.">
                  <input {...text("creditCost2k")} inputMode="numeric" readOnly={autoPrice} className={`${inputClass} ${autoPrice ? "opacity-70" : ""}`} />
                </Field>
                <Field label="Credits at 4K (Ultra HD)" error={err.creditCost4k} hint="Empty = not offered.">
                  <input {...text("creditCost4k")} inputMode="numeric" readOnly={autoPrice} className={`${inputClass} ${autoPrice ? "opacity-70" : ""}`} />
                </Field>
              </>
            )}
          </div>
        </div>
        <CostMargin values={v} onChange={set} packages={packages} defaultUsdMnt={usdMnt} auto={autoPrice} error={err.costUsd} />
      </Section>

      {state.message && (
        <p role="alert" className="text-sm text-red-500">
          {state.message}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || previewUpload.busy || sourceUpload.busy}
          className="flex-1 rounded-full btn-primary py-3 font-semibold text-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : templateId ? "Save changes" : "Create template"}
        </button>
        <Link href="/admin" className="rounded-full border border-foreground/30 px-6 py-3 font-semibold">
          Cancel
        </Link>
      </div>
    </form>
  );
}
