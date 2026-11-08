import Link from "next/link";
import { emailLoginEnabled } from "@/auth";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { isResetTokenValid } from "@/lib/password-reset";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = emailLoginEnabled && (await isResetTokenValid(token));

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-center text-3xl font-bold">Choose a new password</h1>
      {valid ? (
        <div className="mt-6">
          <ResetPasswordForm token={token} />
        </div>
      ) : (
        <div className="mt-4 space-y-4 text-center">
          <p className="text-foreground/70">This link has expired or was already used.</p>
          <Link href="/forgot-password" className="inline-block btn-primary rounded-full px-6 py-3 font-semibold">
            Get a new link
          </Link>
        </div>
      )}
    </div>
  );
}
