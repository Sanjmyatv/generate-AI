"use client";

import { createContext, useContext, type ReactNode } from "react";

export type SocialProvider = "google" | "apple";

interface AuthConfigValue {
  /** Social sign-in providers whose credentials are configured on the server. */
  providers: SocialProvider[];
  /** Legacy email + password login (ENABLE_EMAIL_LOGIN=1); off by default. */
  emailLogin: boolean;
}

const AuthConfigContext = createContext<AuthConfigValue>({ providers: [], emailLogin: false });

/** Hands the server's sign-in setup to every login button and modal below it. */
export function AuthConfigProvider({ value, children }: { value: AuthConfigValue; children: ReactNode }) {
  return <AuthConfigContext.Provider value={value}>{children}</AuthConfigContext.Provider>;
}

export function useAuthConfig() {
  return useContext(AuthConfigContext);
}
