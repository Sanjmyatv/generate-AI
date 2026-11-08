"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { emailLoginEnabled, signIn, signOut } from "@/auth";
import { baseUrlFromHeaders } from "@/lib/actor";
import { getT } from "@/lib/i18n/server";
import { requestPasswordReset, resetPassword } from "@/lib/password-reset";
import { MIN_PASSWORD_LENGTH, createPasswordUser, normalizeEmail } from "@/lib/users";

// Only allow same-site relative paths to avoid open redirects.
function safePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export async function signInWithProvider(provider: "google", redirectTo: string) {
  await signIn(provider, { redirectTo: safePath(redirectTo) });
}

export interface EmailAuthState {
  error: string | null;
}

const SIGN_UP_ERRORS = {
  invalid_email: "err.invalidEmail",
  weak_password: "err.weakPassword",
  email_taken: "err.emailTaken",
} as const;

/** Log in or sign up (form field `mode`) with email + password, then continue to `redirectTo`. */
export async function emailAuthAction(_prev: EmailAuthState, form: FormData): Promise<EmailAuthState> {
  const { t } = await getT();
  if (!emailLoginEnabled) return { error: t("err.emailOffGoogle") };
  const mode = form.get("mode") === "signup" ? "signup" : "login";
  const email = normalizeEmail(form.get("email"));
  const password = form.get("password");
  const redirectTo = safePath(String(form.get("redirectTo") ?? "/"));
  if (typeof password !== "string") return { error: t("err.enterPassword") };

  if (mode === "signup") {
    const created = await createPasswordUser(email, password);
    if (!created.ok) return { error: t(SIGN_UP_ERRORS[created.error], { min: MIN_PASSWORD_LENGTH }) };
  }

  try {
    // On success this throws a redirect, which Next.js turns into the navigation.
    await signIn("credentials", { email, password, redirectTo });
  } catch (e) {
    if (e instanceof AuthError) return { error: t("err.badLogin") };
    throw e;
  }
  return { error: null };
}

export interface ForgotPasswordState {
  sent: boolean;
  error: string | null;
}

/** Emails a reset link. The answer is the same whether or not the address has an account. */
export async function forgotPasswordAction(_prev: ForgotPasswordState, form: FormData): Promise<ForgotPasswordState> {
  const { t } = await getT();
  if (!emailLoginEnabled) return { sent: false, error: t("err.emailOff") };
  const email = normalizeEmail(form.get("email"));
  if (!email) return { sent: false, error: t("err.enterEmail") };
  await requestPasswordReset(email, baseUrlFromHeaders(await headers()), t);
  return { sent: true, error: null };
}

export interface ResetPasswordState {
  error: string | null;
}

/** Sets a new password from a reset link, then logs the person in. */
export async function resetPasswordAction(_prev: ResetPasswordState, form: FormData): Promise<ResetPasswordState> {
  const { t } = await getT();
  if (!emailLoginEnabled) return { error: t("err.emailOff") };
  const token = String(form.get("token") ?? "");
  const password = form.get("password");
  if (password !== form.get("confirm")) return { error: t("err.mismatch") };

  const result = await resetPassword(token, password);
  if (!result.ok) {
    return {
      error:
        result.error === "weak_password"
          ? t("err.weakPassword", { min: MIN_PASSWORD_LENGTH })
          : t("err.linkExpired"),
    };
  }
  try {
    await signIn("credentials", { email: result.email, password, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) return { error: t("err.passwordChanged") };
    throw e;
  }
  return { error: null };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
