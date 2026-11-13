"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useT } from "@/components/I18nProvider";
import { LoginButtons } from "@/components/LoginButtons";
import { SIGNUP_BONUS_CREDITS, formatCredits } from "@/config/pricing";

/**
 * The log in / sign up dialog: dark glass, Google or email. A new account is created
 * the first time someone continues with Google or signs up with an email.
 */
export function LoginModal({
  redirectTo,
  onClose,
  title,
  description,
}: {
  redirectTo: string;
  onClose: () => void;
  title?: string;
  description?: string;
}) {
  const t = useT();
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
          aria-label={t("login.close")}
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-foreground"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-x.svg" alt="" className="size-4" />
        </button>
        <h2 id="login-title" className="pr-8 text-2xl font-semibold tracking-tight text-foreground">
          {title ?? t("login.title")}
        </h2>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-zinc-400">{description ?? t("login.desc", { bonus: formatCredits(SIGNUP_BONUS_CREDITS) })}</p>
        <LoginButtons redirectTo={redirectTo} />
        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
          {t("login.termsPre")}
          <Link href="/terms" target="_blank" className="text-zinc-300 underline underline-offset-2">{t("login.terms")}</Link>
          {t("login.termsAnd")}
          <Link href="/privacy" target="_blank" className="text-zinc-300 underline underline-offset-2">{t("login.privacy")}</Link>
          {t("login.termsPost")}
        </p>
        <button type="button" onClick={onClose} className="mt-4 w-full text-sm text-zinc-400 hover:text-foreground">
          {t("login.notNow")}
        </button>
      </div>
    </div>
  );
}
