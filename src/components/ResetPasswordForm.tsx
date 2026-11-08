"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordState } from "@/app/actions/auth";
import { useT } from "@/components/I18nProvider";

const initialState: ResetPasswordState = { error: null };

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <input
        type="password"
        name="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder={t("reset.newPassword")}
        className="w-full rounded-full border border-foreground/30 bg-transparent px-4 py-3"
      />
      <input
        type="password"
        name="confirm"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder={t("reset.repeat")}
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
        {pending ? t("email.wait") : t("reset.submit")}
      </button>
    </form>
  );
}
