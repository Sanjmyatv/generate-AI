"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type ForgotPasswordState } from "@/app/actions/auth";

const initialState: ForgotPasswordState = { sent: false, error: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  if (state.sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-foreground/80">
          If an account with that email uses a password, we have sent a link to reset it. It works once and expires in 1
          hour.
        </p>
        <p className="text-sm text-foreground/60">Nothing in your inbox? Check your spam folder.</p>
        <Link href="/" className="inline-block text-sm text-foreground/60 hover:text-foreground">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <p className="mb-3 text-center text-foreground/70">
        Enter your email and we will send you a link to choose a new one.
      </p>
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="Email"
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
        {pending ? "Please wait..." : "Send reset link"}
      </button>
      <Link href="/" className="block text-center text-sm text-foreground/60 hover:text-foreground">
        Back to home
      </Link>
    </form>
  );
}
