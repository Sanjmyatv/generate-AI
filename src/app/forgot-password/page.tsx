import { emailLoginEnabled } from "@/auth";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-center text-3xl font-bold">Forgot your password?</h1>
      {emailLoginEnabled ? (
        <div className="mt-2">
          <ForgotPasswordForm />
        </div>
      ) : (
        <p className="mt-4 text-center text-foreground/70">Email login is turned off. Continue with Google instead.</p>
      )}
    </div>
  );
}
