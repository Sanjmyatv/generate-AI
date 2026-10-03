import Link from "next/link";
import { mockUser } from "@/lib/mock-data";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-3xl font-bold">Profile</h1>
      <dl className="mt-6 divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
        <div className="flex justify-between p-4">
          <dt className="text-foreground/60">Name</dt>
          <dd className="font-semibold">{mockUser.name}</dd>
        </div>
        <div className="flex justify-between p-4">
          <dt className="text-foreground/60">User ID</dt>
          <dd className="font-mono">{mockUser.id}</dd>
        </div>
        <div className="flex items-center justify-between p-4">
          <dt className="text-foreground/60">Credits</dt>
          <dd className="flex items-center gap-3">
            <span className="font-semibold">{mockUser.credits}</span>
            <Link
              href="/pricing"
              className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background"
            >
              Buy Credits
            </Link>
          </dd>
        </div>
      </dl>
      <button className="mt-6 w-full rounded-full border border-foreground/30 py-3 font-semibold">
        Log Out
      </button>
    </div>
  );
}
