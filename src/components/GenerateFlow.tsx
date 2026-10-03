"use client";

import { useState } from "react";
import { LoginModal } from "@/components/LoginModal";
import type { Template } from "@/types";

type Step = "detail" | "upload" | "processing" | "result";

// UI-only skeleton. Real generation must go through the backend: create an async
// job (QUEUED → PROCESSING → COMPLETED/FAILED), reserve credits server-side and
// refund on failure. The client never decides credit balances.
export function GenerateFlow({
  template,
  isAuthenticated,
  providers,
}: {
  template: Template;
  isAuthenticated: boolean;
  providers: ("google" | "apple")[];
}) {
  const [step, setStep] = useState<Step>("detail");
  const [files, setFiles] = useState<File[]>([]);
  const [showLogin, setShowLogin] = useState(false);

  function download() {
    // Guests can generate and preview, but must log in before downloading.
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }
    // TODO: request a temporary signed URL for the full-resolution file.
  }

  const needed = template.requiredPhotoCount;
  const hint =
    template.photoRequirement === "full-body"
      ? "Use a full-body photo."
      : "Use a clear photo with your face visible.";

  function generate() {
    setStep("processing");
    setTimeout(() => setStep("result"), 2000);
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/30" />
      <h1 className="mt-4 text-2xl font-bold">{template.name}</h1>
      <p className="mt-1 text-foreground/70">{template.description}</p>
      <p className="mt-2 text-sm text-foreground/60">
        {template.type === "video" ? "Video" : "Image"} · Cost:{" "}
        {template.creditCost} {template.creditCost === 1 ? "credit" : "credits"}
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
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-foreground/30 p-6 text-center text-sm">
            Upload your photo{needed > 1 ? "s" : ""} ({files.length}/{needed})
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple={needed > 1}
              className="hidden"
              onChange={(e) =>
                setFiles(Array.from(e.target.files ?? []).slice(0, needed))
              }
            />
          </label>
          <p className="text-xs text-foreground/60">{hint}</p>
          <button
            disabled={files.length !== needed}
            onClick={generate}
            className="w-full rounded-full bg-foreground py-3 font-semibold text-background disabled:opacity-40"
          >
            Generate
          </button>
        </div>
      )}

      {step === "processing" && (
        <div className="mt-6 text-center">
          <p className="font-semibold">Creating your masterpiece...</p>
          <p className="text-sm text-foreground/60">This may take a little while.</p>
        </div>
      )}

      {step === "result" && (
        <div className="mt-6 space-y-3">
          <p className="text-center font-semibold">Your creation is ready.</p>
          <button
            onClick={download}
            className="w-full rounded-full bg-foreground py-3 font-semibold text-background"
          >
            Download
          </button>
          <button
            onClick={() => {
              setFiles([]);
              setStep("detail");
            }}
            className="w-full rounded-full border border-foreground/30 py-3 font-semibold"
          >
            Create Another
          </button>
        </div>
      )}

      {showLogin && (
        <LoginModal
          providers={providers}
          redirectTo={`/templates/${template.id}`}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}
