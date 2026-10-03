"use server";

import { signIn, signOut } from "@/auth";

// Only allow same-site relative paths to avoid open redirects.
function safePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export async function signInWithProvider(provider: "google" | "apple", redirectTo: string) {
  await signIn(provider, { redirectTo: safePath(redirectTo) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
