"use client";

import { signInWithProvider } from "@/app/actions/auth";
import { EmailAuthForm } from "@/components/EmailAuthForm";

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
  return (
    <div className="space-y-4">
      <EmailAuthForm redirectTo={redirectTo} />
      {providers.length > 0 && (
        <>
          <div className="flex items-center gap-3 text-xs text-foreground/50">
            <span className="h-px flex-1 bg-foreground/15" />
            or
            <span className="h-px flex-1 bg-foreground/15" />
          </div>
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
        </>
      )}
    </div>
  );
}
