"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type ForgotPasswordState } from "@/app/actions/auth";
import { useT } from "@/components/I18nProvider";

const initialState: ForgotPasswordState = { sent: false, error: null };

export function ForgotPasswordForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  if (state.sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-foreground/80">
          {t("forgot.sent")}
        </p>
        <p className="text-sm text-foreground/60">{t("forgot.spam")}</p>
        <Link href="/" className="inline-block text-sm text-foreground/60 hover:text-foreground">
          {t("forgot.back")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <p className="mb-3 text-center text-foreground/70">
        {t("forgot.intro")}
      </p>
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder={t("email.email")}
        className="w-full rounded-full border border-foreground/30 bg-transparent px-4 py-3"
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-500">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full btn-primary py-3 font-semibold text-foreground disabled:opacity-50"
      >
        {pending ? t("email.wait") : t("forgot.send")}
      </button>
      <Link href="/" className="block text-center text-sm text-foreground/60 hover:text-foreground">
        {t("forgot.back")}
      </Link>
    </form>
  );
}
