"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { saveTemplateAction, type TemplateFormState } from "@/app/actions/admin";
import { TemplatePreview } from "@/components/TemplatePreview";
import {
  CARD_SHAPES,
  ENGINES,
  IMAGE_ASPECTS,
  IMAGE_QUALITIES,
  IMAGE_RESOLUTIONS,
  MAX_PHOTOS,
  VIDEO_RATIOS,
  VIDEO_RESOLUTIONS,
  type Engine,
  type TemplateFormValues,
} from "@/lib/template-admin";

const initialState: TemplateFormState = { errors: {}, message: null };

/** Genjutsu list price per second of source video, before the account's discount. */
const GENJUTSU_RATE: Record<string, number> = { "480p": 0.318, "720p": 0.681, "1080p": 1.632 };

const PROMPT_HELP: Record<Engine, string> = {
  genjutsu:
    'Optional. Say who replaces whom, e.g. "Replace the dancer with the person in the first reference image." Refer to the photos as the first, second, third reference image.',
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
  templateId,
}: {
  initial: TemplateFormValues;
  categories: { id: string; name: string }[];
  templateId?: string;
}) {
  const [v, setV] = useState(initial);
  const [state, formAction, pending] = useActionState(saveTemplateAction, initialState);
  const [previewUpload, setPreviewUpload] = useState<UploadState>({ busy: false, error: null });
  const [sourceUpload, setSourceUpload] = useState<UploadState>({ busy: false, error: null });
  const [sourceSeconds, setSourceSeconds] = useState<number | null>(null);

  const set = <K extends keyof TemplateFormValues>(key: K, value: TemplateFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));
  const text = (key: keyof TemplateFormValues) => ({
    name: key,
    value: String(v[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(key, e.target.value as never),
  });

  const err = state.errors;
  const needsVideo = v.engine === "genjutsu" || v.engine === "seedance-edit";
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
      }
      setState({ busy: false, error: null });
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : "Upload failed." });
    }
  }

  const estimate =
    v.engine === "genjutsu" && sourceSeconds !== null
      ? Math.ceil(sourceSeconds) * (GENJUTSU_RATE[v.videoResolution] ?? 0)
      : null;

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

      <Section title="Basics">
        <Field label="Name" error={err.name}>
          <input {...text("name")} maxLength={80} className={inputClass} />
        </Field>
        <Field label="Description" error={err.description} hint="Shown under the template name.">
          <textarea {...text("description")} rows={2} maxLength={500} className={inputClass} />
        </Field>
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
                  v.type === t ? "border-foreground bg-foreground text-background" : "border-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={v.type === t}
                  onChange={() => {
                    set("type", t);
                    set("engine", ENGINES.find((e) => e.type === t)!.value);
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
                  onChange={() => set("engine", e.value)}
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

        {needsVideo && (
          <Field label="Source video" error={err.sourceVideoUrl || sourceUpload.error || undefined} hint="MP4 or MOV, at least 4 seconds, up to 30 seconds is used.">
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
                  {estimate !== null && (
                    <p>
                      Genjutsu list price ≈ ${estimate.toFixed(2)} per generation at {v.videoResolution} (your
                      account discount applies on top). Set the credit cost above that.
                    </p>
                  )}
                </div>
              </div>
            )}
            <input
              value={v.sourceVideoUrl}
              onChange={(e) => set("sourceVideoUrl", e.target.value)}
              placeholder="…or paste a public https link"
              className={`${inputClass} mt-2 text-sm`}
            />
          </Field>
        )}

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
            <Field label="Quality" error={err.imageQuality}>
              <select {...text("imageQuality")} className={inputClass}>
                {IMAGE_QUALITIES.map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </select>
            </Field>
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
            <div className="grid grid-cols-3 gap-4">
              <Field label="Resolution" error={err.videoResolution}>
                <select {...text("videoResolution")} className={inputClass}>
                  {VIDEO_RESOLUTIONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              {v.engine === "seedance-reference" && (
                <>
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
                </>
              )}
            </div>
            {v.engine !== "genjutsu" && (
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
            <p className="text-xs text-foreground/60">Higher resolution costs more per generation.</p>
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
        <Field label="Photo labels" error={err.photoLabels} hint="One per line, in photo order. Shown under each upload slot.">
          <textarea {...text("photoLabels")} rows={3} className={inputClass} />
        </Field>
        <Field label="Credit cost" error={err.creditCost} hint="Credits charged for one generation.">
          <input {...text("creditCost")} inputMode="numeric" className={`${inputClass} max-w-32`} />
        </Field>
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
          className="flex-1 rounded-full bg-foreground py-3 font-semibold text-background disabled:opacity-50"
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
