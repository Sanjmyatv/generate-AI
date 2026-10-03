"use client";

import { signInWithProvider } from "@/app/actions/auth";

type Provider = "google" | "apple";

const labels: Record<Provider, string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
};

export function LoginButtons({
  providers,
  redirectTo,
}: {
  providers: Provider[];
  redirectTo: string;
}) {
  if (providers.length === 0) {
    return (
      <p className="text-sm text-foreground/60">
        Login is not available yet. Please try again later.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <form key={provider} action={() => signInWithProvider(provider, redirectTo)}>
          <button
            type="submit"
            className="w-full rounded-full border border-foreground/30 py-3 font-semibold hover:bg-foreground/5"
          >
            {labels[provider]}
          </button>
        </form>
      ))}
    </div>
  );
}
