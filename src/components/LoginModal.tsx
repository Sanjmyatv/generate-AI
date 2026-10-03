"use client";

import { LoginButtons } from "@/components/LoginButtons";

export function LoginModal({
  providers,
  redirectTo,
  onClose,
}: {
  providers: ("google" | "apple")[];
  redirectTo: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-background p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="login-title" className="text-xl font-bold">
          Log in to download
        </h2>
        <p className="mt-2 mb-5 text-sm text-foreground/70">
          Your creation is ready. Log in with Google or Apple to download your
          full-resolution result.
        </p>
        <LoginButtons providers={providers} redirectTo={redirectTo} />
        <button
          onClick={onClose}
          className="mt-4 w-full text-sm text-foreground/60 hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
