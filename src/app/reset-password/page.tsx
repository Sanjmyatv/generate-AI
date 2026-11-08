import Link from "next/link";
import { emailLoginEnabled } from "@/auth";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { getT } from "@/lib/i18n/server";
import { isResetTokenValid } from "@/lib/password-reset";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("reset.meta"), robots: { index: false } };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token = "" }, { t }] = await Promise.all([searchParams, getT()]);
  const valid = emailLoginEnabled && (await isResetTokenValid(token));

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-center text-3xl font-bold">{t("reset.title")}</h1>
      {valid ? (
        <div className="mt-6">
          <ResetPasswordForm token={token} />
        </div>
      ) : (
        <div className="mt-4 space-y-4 text-center">
          <p className="text-foreground/70">{t("reset.expired")}</p>
          <Link href="/forgot-password" className="inline-block btn-primary rounded-full px-6 py-3 font-semibold">
            {t("reset.newLink")}
          </Link>
        </div>
      )}
    </div>
  );
}
