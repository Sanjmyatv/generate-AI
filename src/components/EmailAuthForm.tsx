"use client";

import { useActionState, useState } from "react";
import { emailAuthAction, type EmailAuthState } from "@/app/actions/auth";

const initialState: EmailAuthState = { error: null };

/** Email + password log in / sign up, switchable in place. */
export function EmailAuthForm({ redirectTo }: { redirectTo: string }) {
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
        placeholder="Email"
        className="w-full rounded-full border border-foreground/30 bg-transparent px-4 py-3"
      />
      <input
        type="password"
        name="password"
        required
        minLength={signup ? 8 : undefined}
        autoComplete={signup ? "new-password" : "current-password"}
        placeholder={signup ? "Password (at least 8 characters)" : "Password"}
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
        {pending ? "Please wait..." : signup ? "Create Account" : "Log In"}
      </button>
      <button
        type="button"
        onClick={() => setMode(signup ? "login" : "signup")}
        className="w-full text-sm text-foreground/60 hover:text-foreground"
      >
        {signup ? "Already have an account? Log in" : "New here? Create an account"}
      </button>
    </form>
  );
}
