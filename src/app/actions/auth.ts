"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { MIN_PASSWORD_LENGTH, createPasswordUser, normalizeEmail } from "@/lib/users";

// Only allow same-site relative paths to avoid open redirects.
function safePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export async function signInWithProvider(provider: "google" | "apple", redirectTo: string) {
  await signIn(provider, { redirectTo: safePath(redirectTo) });
}

export interface EmailAuthState {
  error: string | null;
}

const SIGN_UP_ERRORS = {
  invalid_email: "Please enter a valid email address.",
  weak_password: `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  email_taken: "An account with this email already exists. Try logging in instead.",
} as const;

/** Log in or sign up (form field `mode`) with email + password, then continue to `redirectTo`. */
export async function emailAuthAction(_prev: EmailAuthState, form: FormData): Promise<EmailAuthState> {
  const mode = form.get("mode") === "signup" ? "signup" : "login";
  const email = normalizeEmail(form.get("email"));
  const password = form.get("password");
  const redirectTo = safePath(String(form.get("redirectTo") ?? "/"));
  if (typeof password !== "string") return { error: "Please enter your password." };

  if (mode === "signup") {
    const created = await createPasswordUser(email, password);
    if (!created.ok) return { error: SIGN_UP_ERRORS[created.error] };
  }

  try {
    // On success this throws a redirect, which Next.js turns into the navigation.
    await signIn("credentials", { email, password, redirectTo });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Incorrect email or password." };
    throw e;
  }
  return { error: null };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
