import { emailLoginEnabled } from "@/auth";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("forgot.meta"), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-center text-3xl font-bold">{t("forgot.title")}</h1>
      {emailLoginEnabled ? (
        <div className="mt-2">
          <ForgotPasswordForm />
        </div>
      ) : (
        <p className="mt-4 text-center text-foreground/70">{t("forgot.off")}</p>
      )}
    </div>
  );
}
