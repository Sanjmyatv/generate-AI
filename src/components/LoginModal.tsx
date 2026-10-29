"use client";

import { useEffect } from "react";
import { LoginButtons } from "@/components/LoginButtons";

/**
 * The log in / sign up dialog: dark glass, Google and Apple only. A new account is created
 * the first time someone continues with a provider.
 */
export function LoginModal({
  redirectTo,
  onClose,
  title = "Log in or sign up",
  description = "Continue with Google or Apple, or use your email. New Google and Apple accounts start with 1,000 free credits.",
}: {
  redirectTo: string;
  onClose: () => void;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="animate-pop-in relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-zinc-800/80 bg-zinc-950/90 p-7 shadow-[0_0_60px_rgba(168,85,247,0.18)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-foreground"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-x.svg" alt="" className="size-4" />
        </button>
        <h2 id="login-title" className="pr-8 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
        <LoginButtons redirectTo={redirectTo} />
        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
          By continuing, you agree to our <span className="text-zinc-300 underline underline-offset-2">Terms of Service</span> and{" "}
          <span className="text-zinc-300 underline underline-offset-2">Privacy Policy</span>.
        </p>
        <button type="button" onClick={onClose} className="mt-4 w-full text-sm text-zinc-400 hover:text-foreground">
          Not now
        </button>
      </div>
    </div>
  );
}
