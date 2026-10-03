"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoginModal } from "@/components/LoginModal";
import { prepareImage } from "@/lib/image-client";
import type { Template } from "@/types";

type Step = "detail" | "upload" | "processing" | "result" | "error";

interface StatusResponse {
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  videoUrl: string | null;
  /** Provider error code when the job failed (e.g. an input-moderation rejection). */
  error: string | null;
  refunded: boolean;
}

// Provider codes meaning the uploaded photo itself was rejected.
const REJECTED_INPUT = /sensitive|moderation|privacy|inputimage|inputvideo|face/i;

interface FlowError {
  title: string;
  message: string;
  /** Shown when the user simply needs more credits. */
  buyCredits?: boolean;
}

const POLL_INTERVAL_MS = 3000;
const MAX_NETWORK_FAILURES = 5;

const PROGRESS_MESSAGES = [
  "Creating your masterpiece...",
  "Teaching the dancers your face...",
  "Adding the final touches...",
  "Almost there, this may take a little while.",
];

class ApiError extends Error {
  constructor(readonly code: string, readonly extra?: Record<string, unknown>) {
    super(code);
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "unknown", data);
  return data as T;
}

async function uploadPhoto(file: File): Promise<string> {
  let blob: Blob;
  try {
    blob = await prepareImage(file);
  } catch {
    throw new ApiError("invalid_image");
  }
  const form = new FormData();
  form.append("file", blob, "photo.jpg");
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "upload_failed");
  return data.id as string;
}

function toFlowError(e: unknown): FlowError {
  const code = e instanceof ApiError ? e.code : "network";
  switch (code) {
    case "invalid_image":
      return {
        title: "Invalid image",
        message: "This photo doesn't meet the requirements. Please upload a clearer photo.",
      };
    case "upload_failed":
      return { title: "Upload error", message: "We couldn't upload your photo. Please try another image." };
    case "insufficient_credits": {
      const required = e instanceof ApiError ? e.extra?.required : undefined;
      return {
        title: "Not enough credits",
        message: `You need ${required ?? "more"} credits to generate this template.`,
        buyCredits: true,
      };
    }
    case "too_many_active":
    case "rate_limited":
      return { title: "Slow down", message: "You have a generation in progress. Please wait for it to finish." };
    case "template_unavailable":
      return { title: "Template unavailable", message: "This template isn't ready yet. Please try another one." };
    case "generation_failed":
      return {
        title: "Something went wrong",
        message: "Something went wrong while creating your content. Any credits were refunded.",
      };
    case "network":
      return {
        title: "Network error",
        message: "Connection lost. Please check your internet connection and try again.",
      };
    default:
      return { title: "Something went wrong", message: "Please try again in a moment." };
  }
}

/** A single photo picker: shows a preview once chosen and lets the user replace it. */
function PhotoSlot({
  label,
  file,
  onSelect,
}: {
  label: string;
  file: File | null;
  onSelect: (file: File) => void;
}) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <label className="block cursor-pointer text-center">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-foreground/30 text-xs text-foreground/60">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="px-2">+ Upload</span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelect(f);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
      </div>
      <span className="mt-1 block text-xs font-medium">{label}</span>
      {file && <span className="text-[11px] text-foreground/50">Tap to replace</span>}
    </label>
  );
}

export function GenerateFlow({
  template,
  isAuthenticated,
  providers,
  resumeId,
}: {
  template: Template;
  isAuthenticated: boolean;
  providers: ("google" | "apple")[];
  /** A generation id from `?g=` — lets a guest return here after logging in. */
  resumeId?: string;
}) {
  const [step, setStep] = useState<Step>(resumeId ? "processing" : "detail");
  // One entry per required photo; null until the user picks that photo.
  const [photos, setPhotos] = useState<(File | null)[]>(() =>
    Array.from({ length: template.requiredPhotoCount }, () => null),
  );
  const [generationId, setGenerationId] = useState<string | null>(resumeId ?? null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<FlowError | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Set when polling starts; kept in a ref so the timer doesn't re-render the tree.
  const startedAt = useRef(0);

  const needed = template.requiredPhotoCount;
  const allPhotosSelected = photos.every((p): p is File => p !== null);
  const hint =
    template.photoRequirement === "full-body"
      ? "Use a full-body photo."
      : "Use a clear photo with your face visible.";

  const fail = useCallback((flowError: FlowError) => {
    setError(flowError);
    setStep("error");
  }, []);

  const reset = useCallback(() => {
    setPhotos(Array.from({ length: needed }, () => null));
    setGenerationId(null);
    setVideoUrl(null);
    setError(null);
    setStep("detail");
    window.history.replaceState(null, "", window.location.pathname);
  }, [needed]);

  async function generate() {
    setError(null);
    startedAt.current = 0; // restarted by the polling effect
    setElapsed(0);
    setStep("processing");
    try {
      // Promise.all keeps the order, which the AI uses to map Image 1..N to the dancers.
      const uploadIds = await Promise.all(photos.filter((p): p is File => p !== null).map(uploadPhoto));
      const { id } = await postJson<{ id: string }>("/api/generate", {
        templateId: template.id,
        uploadIds,
      });
      // Keep the id in the URL so the result survives a login redirect or refresh.
      window.history.replaceState(null, "", `?g=${id}`);
      setGenerationId(id);
    } catch (e) {
      if (e instanceof ApiError && e.code === "login_required") {
        setStep("upload");
        setShowLogin(true);
        return;
      }
      fail(toFlowError(e));
    }
  }

  // Poll our status endpoint until the job finishes. Never assume success from submit.
  useEffect(() => {
    if (step !== "processing" || !generationId) return;
    let cancelled = false;
    let failures = 0;
    if (!startedAt.current) startedAt.current = Date.now();

    const tick = async () => {
      try {
        const res = await fetch(`/api/status/${generationId}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404) {
          reset();
          return;
        }
        if (!res.ok) throw new Error("status_failed");
        const data = (await res.json()) as StatusResponse;
        failures = 0;
        if (data.status === "COMPLETED" && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setStep("result");
        } else if (data.status === "FAILED") {
          const refund = data.refunded ? " Your credits have been refunded." : "";
          if (data.error && REJECTED_INPUT.test(data.error)) {
            fail({
              title: "Invalid image",
              message: `This photo doesn't meet the requirements. Please upload a clearer photo.${refund}`,
            });
          } else {
            fail({
              title: "Something went wrong",
              message: `Something went wrong while creating your content.${refund || " Please try again."}`,
            });
          }
        }
      } catch {
        if (cancelled) return;
        if (++failures >= MAX_NETWORK_FAILURES) fail(toFlowError(new Error("network")));
      }
    };

    void tick();
    const poll = setInterval(tick, POLL_INTERVAL_MS);
    const clock = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [step, generationId, fail, reset]);

  const message = PROGRESS_MESSAGES[Math.min(Math.floor(elapsed / 20), PROGRESS_MESSAGES.length - 1)];

  return (
    <div className="mx-auto max-w-md py-8">
      {step !== "result" && (
        <div className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/30" />
      )}
      <h1 className="mt-4 text-2xl font-bold">{template.name}</h1>
      <p className="mt-1 text-foreground/70">{template.description}</p>
      <p className="mt-2 text-sm text-foreground/60">
        {template.type === "video" ? "Video" : "Image"} · Cost: {template.creditCost}{" "}
        {template.creditCost === 1 ? "credit" : "credits"}
      </p>

      {step === "detail" && (
        <button
          onClick={() => setStep("upload")}
          className="mt-6 w-full rounded-full bg-foreground py-3 font-semibold text-background"
        >
          Use This Template
        </button>
      )}

      {step === "upload" && (
        <div className="mt-6 space-y-3">
          {/* One slot per required photo, in the order the AI maps them to the template. */}
          <div className={needed > 1 ? "grid grid-cols-3 gap-3" : ""}>
            {photos.map((file, i) => (
              <PhotoSlot
                key={i}
                label={template.photoLabels[i] ?? (needed > 1 ? `Photo ${i + 1}` : "Your photo")}
                file={file}
                onSelect={(f) => setPhotos((prev) => prev.map((p, j) => (j === i ? f : p)))}
              />
            ))}
          </div>
          <p className="text-xs text-foreground/60">
            {needed > 1 ? `Add ${needed} photos, one per person. ` : ""}
            {hint}
          </p>
          <button
            disabled={!allPhotosSelected}
            onClick={generate}
            className="w-full rounded-full bg-foreground py-3 font-semibold text-background disabled:opacity-40"
          >
            Generate Video ✨
          </button>
        </div>
      )}

      {step === "processing" && (
        <div className="mt-6 text-center" role="status" aria-live="polite">
          <div className="mx-auto h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-violet-500 to-pink-500" />
          </div>
          <p className="mt-4 font-semibold">{message}</p>
          <p className="text-sm text-foreground/60">
            This may take a few minutes · {Math.floor(elapsed / 60)}:
            {String(elapsed % 60).padStart(2, "0")}
          </p>
        </div>
      )}

      {step === "error" && error && (
        <div className="mt-6 space-y-3 text-center" role="alert">
          <p className="font-semibold">{error.title}</p>
          <p className="text-sm text-foreground/70">{error.message}</p>
          {error.buyCredits ? (
            <Link
              href="/pricing"
              className="block rounded-full bg-foreground py-3 font-semibold text-background"
            >
              Buy Credits
            </Link>
          ) : (
            <button
              onClick={() => setStep("upload")}
              className="w-full rounded-full bg-foreground py-3 font-semibold text-background"
            >
              Try Again
            </button>
          )}
          <button onClick={reset} className="w-full text-sm text-foreground/60">
            Cancel
          </button>
        </div>
      )}

      {step === "result" && videoUrl && (
        <div className="space-y-3">
          <p className="text-center font-semibold">Your creation is ready.</p>
          <video
            src={videoUrl}
            controls
            playsInline
            autoPlay
            loop
            className="mx-auto max-h-[70vh] w-full rounded-2xl bg-black"
          />
          {isAuthenticated ? (
            <a
              href={`${videoUrl}?download=1`}
              className="block rounded-full bg-foreground py-3 text-center font-semibold text-background"
            >
              Download
            </a>
          ) : (
            // Guests can preview but must log in before downloading.
            <button
              onClick={() => setShowLogin(true)}
              className="w-full rounded-full bg-foreground py-3 font-semibold text-background"
            >
              Download
            </button>
          )}
          <button
            onClick={reset}
            className="w-full rounded-full border border-foreground/30 py-3 font-semibold"
          >
            Create Another
          </button>
        </div>
      )}

      {showLogin && (
        <LoginModal
          providers={providers}
          redirectTo={generationId ? `/templates/${template.id}?g=${generationId}` : `/templates/${template.id}`}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}
