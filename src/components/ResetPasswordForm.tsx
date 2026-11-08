"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordState } from "@/app/actions/auth";

const initialState: ResetPasswordState = { error: null };

export function ResetPasswordForm({ token }: { token: string }) {
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
        placeholder="New password (at least 8 characters)"
        className="w-full rounded-full border border-foreground/30 bg-transparent px-4 py-3"
      />
      <input
        type="password"
        name="confirm"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Repeat the new password"
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
        {pending ? "Please wait..." : "Change password and log in"}
      </button>
    </form>
  );
}
