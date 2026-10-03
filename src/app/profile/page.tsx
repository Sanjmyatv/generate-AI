import Link from "next/link";
import { auth, enabledProviders } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { LoginButtons } from "@/components/LoginButtons";
import { getUserById } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  const user = session?.user?.id ? await getUserById(session.user.id) : null;

  if (!user) {
    return (
      <div className="mx-auto max-w-sm py-10 text-center">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="mt-2 mb-6 text-foreground/70">
          Log in to see your credits and creations.
        </p>
        <LoginButtons providers={enabledProviders} redirectTo="/profile" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-3xl font-bold">Profile</h1>
      <dl className="mt-6 divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
        <div className="flex justify-between p-4">
          <dt className="text-foreground/60">Name</dt>
          <dd className="font-semibold">{user.name ?? user.email}</dd>
        </div>
        <div className="flex justify-between p-4">
          <dt className="text-foreground/60">User ID</dt>
          <dd className="font-mono">{user.publicId}</dd>
        </div>
        <div className="flex items-center justify-between p-4">
          <dt className="text-foreground/60">Credits</dt>
          <dd className="flex items-center gap-3">
            <span className="font-semibold">{user.credits}</span>
            <Link
              href="/pricing"
              className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background"
            >
              Buy Credits
            </Link>
          </dd>
        </div>
      </dl>
      <form action={signOutAction}>
        <button className="mt-6 w-full rounded-full border border-foreground/30 py-3 font-semibold">
          Log Out
        </button>
      </form>
    </div>
  );
}
