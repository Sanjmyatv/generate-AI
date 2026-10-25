import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="py-6">
      <div className="flex items-center justify-between border-b border-foreground/15 pb-3">
        <Link href="/admin" className="text-xl font-bold">
          Admin
        </Link>
        <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
          Back to site
        </Link>
      </div>
      {children}
    </div>
  );
}
