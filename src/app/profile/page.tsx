import Link from "next/link";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { LoginButtons } from "@/components/LoginButtons";
import { Reveal } from "@/components/Reveal";
import { formatCredits } from "@/config/pricing";
import { getT } from "@/lib/i18n/server";
import { getUserById } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { t } = await getT();
  const session = await auth();
  const user = session?.user?.id ? await getUserById(session.user.id) : null;

  if (!user) {
    return (
      <div className="mx-auto max-w-sm py-10 text-center">
        <h1 className="text-3xl font-bold">{t("profile.title")}</h1>
        <p className="mt-2 mb-6 text-foreground/70">
          {t("profile.loginPrompt")}
        </p>
        <LoginButtons redirectTo="/profile" />
      </div>
    );
  }

  const methods = [user.googleId && "Google", user.appleId && "Apple", user.passwordHash && t("profile.method.password")].filter(
    Boolean,
  );

  return (
    <div className="mx-auto max-w-md space-y-10 py-10">
      <Reveal as="section" id="profile">
        <h1 className="text-3xl font-bold">{t("profile.title")}</h1>
        <dl className="mt-6 divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
          <div className="flex justify-between p-4">
            <dt className="text-foreground/60">{t("profile.name")}</dt>
            <dd className="font-semibold">{user.name ?? user.email}</dd>
          </div>
          <div className="flex justify-between p-4">
            <dt className="text-foreground/60">{t("profile.userId")}</dt>
            <dd className="font-mono">{user.publicId}</dd>
          </div>
          <div className="flex items-center justify-between p-4">
            <dt className="text-foreground/60">{t("profile.credits")}</dt>
            <dd className="flex items-center gap-3">
              <span className="font-semibold">{formatCredits(Number(user.credits))}</span>
              <Link href="/pricing" className="btn-primary rounded-full px-3 py-1 text-xs font-medium">
                {t("profile.buy")}
              </Link>
            </dd>
          </div>
        </dl>
        {user.isAdmin && (
          <Link href="/admin" className="btn-primary mt-6 block rounded-full py-3 text-center font-medium">
            {t("profile.admin")}
          </Link>
        )}
      </Reveal>

      <Reveal as="section" id="settings" delay={80}>
        <h2 className="text-xl font-semibold">{t("profile.settings")}</h2>
        <dl className="mt-4 divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
          <div className="flex justify-between gap-4 p-4">
            <dt className="text-foreground/60">{t("profile.email")}</dt>
            <dd className="truncate">{user.email ?? t("profile.noEmail")}</dd>
          </div>
          <div className="flex justify-between gap-4 p-4">
            <dt className="text-foreground/60">{t("profile.signedInWith")}</dt>
            <dd>{methods.length > 0 ? methods.join(", ") : "—"}</dd>
          </div>
        </dl>
        <form action={signOutAction}>
          <button className="btn-glass mt-6 w-full rounded-full py-3 font-medium text-red-300">{t("profile.logOut")}</button>
        </form>
      </Reveal>
    </div>
  );
}
