"use client";

import { signInWithProvider } from "@/app/actions/auth";
import { useAuthConfig, type SocialProvider } from "@/components/AuthConfig";
import { EmailAuthForm } from "@/components/EmailAuthForm";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5 shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5 shrink-0">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

const BUTTONS: { id: SocialProvider; label: string; Icon: () => React.ReactElement }[] = [
  { id: "google", label: "Continue with Google", Icon: GoogleIcon },
  { id: "apple", label: "Continue with Apple", Icon: AppleIcon },
];

/**
 * Sign in with Google or Apple. Both buttons always show; one whose credentials aren't set on
 * the server is disabled and says so. Below them is the email + password form (log in, or
 * create an account), unless ENABLE_EMAIL_LOGIN=0.
 */
export function LoginButtons({ redirectTo }: { redirectTo: string }) {
  const { providers, emailLogin } = useAuthConfig();

  return (
    <div className="space-y-3">
      {BUTTONS.map(({ id, label, Icon }) => {
        const available = providers.includes(id);
        return (
          <form key={id} action={() => signInWithProvider(id, redirectTo)}>
            <button
              type="submit"
              disabled={!available}
              className="btn-glass flex w-full items-center justify-center gap-3 rounded-2xl py-3.5 text-[15px] font-medium disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
            >
              <Icon />
              {label}
              {!available && <span className="text-xs font-normal text-muted">(not set up yet)</span>}
            </button>
          </form>
        );
      })}

      {emailLogin && (
        <>
          <div className="flex items-center gap-3 pt-2 text-xs text-foreground/50">
            <span className="h-px flex-1 bg-foreground/15" />
            or use your email
            <span className="h-px flex-1 bg-foreground/15" />
          </div>
          <EmailAuthForm redirectTo={redirectTo} />
        </>
      )}
    </div>
  );
}
