"use client";

import { useActionState, useState } from "react";
import { emailAuthAction, type EmailAuthState } from "@/app/actions/auth";
import { useT } from "@/components/I18nProvider";

const initialState: EmailAuthState = { error: null };

/** Email + password log in / sign up, switchable in place. */
export function EmailAuthForm({ redirectTo }: { redirectTo: string }) {
  const t = useT();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [state, formAction, pending] = useActionState(emailAuthAction, initialState);
  const signup = mode === "signup";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder={t("email.email")}
        className="w-full rounded-full border border-foreground/30 bg-transparent px-4 py-3"
      />
      <input
        type="password"
        name="password"
        required
        minLength={signup ? 8 : undefined}
        autoComplete={signup ? "new-password" : "current-password"}
        placeholder={signup ? t("email.passwordNew") : t("email.password")}
        className="w-full rounded-full border border-foreground/30 bg-transparent px-4 py-3"
      />
      {!signup && (
        // A plain link (full page load) so the login dialog closes with the navigation.
        <a href="/forgot-password" className="block text-right text-sm text-foreground/60 hover:text-foreground">
          {t("email.forgot")}
        </a>
      )}
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
        {pending ? t("email.wait") : signup ? t("email.create") : t("email.login")}
      </button>
      <button
        type="button"
        onClick={() => setMode(signup ? "login" : "signup")}
        className="w-full text-sm text-foreground/60 hover:text-foreground"
      >
        {signup ? t("email.haveAccount") : t("email.new")}
      </button>
    </form>
  );
}
