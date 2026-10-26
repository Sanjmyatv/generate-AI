import Link from "next/link";
import { auth, enabledProviders } from "@/auth";
import { LoginButtons } from "@/components/LoginButtons";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/db";
import { claimGuestGenerations } from "@/lib/generations";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/** "9:16" -> "9 / 16" for the CSS aspect-ratio property; falls back to 3/4. */
function aspectCss(ratio: string) {
  const [w, h] = ratio.split(":").map(Number);
  return w > 0 && h > 0 ? `${w} / ${h}` : "3 / 4";
}

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function HistoryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-sm py-10 text-center">
        <h1 className="text-3xl font-bold">History</h1>
        <p className="mt-2 mb-6 text-foreground/70">
          Log in to see your previous creations.
        </p>
        <LoginButtons providers={enabledProviders} redirectTo="/history" />
      </div>
    );
  }

  // Creations made before logging in belong to this account now.
  await claimGuestGenerations(await getActor());

  const generations = await prisma.generation.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    select: {
      id: true,
      status: true,
      createdAt: true,
      template: { select: { id: true, name: true, aspectRatio: true, type: true } },
    },
  });

  if (generations.length === 0) {
    return (
      <div className="py-10">
        <h1 className="text-3xl font-bold">History</h1>
        <div className="mt-8 text-center">
          <p className="font-semibold">Your creations will appear here.</p>
          <p className="text-sm text-foreground/60">
            Choose a template and create your first AI masterpiece.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <h1 className="text-3xl font-bold">History</h1>
      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {generations.map((g) => (
          <li key={g.id}>
            <div
              className="overflow-hidden rounded-xl bg-foreground/10"
              style={{ aspectRatio: aspectCss(g.template.aspectRatio) }}
            >
              {g.status === "COMPLETED" && g.template.type === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/generations/${g.id}/video`}
                  alt={g.template.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : g.status === "COMPLETED" ? (
                <video
                  src={`/api/generations/${g.id}/video`}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full bg-black object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-3 text-center text-sm text-foreground/60">
                  {g.status === "FAILED" ? "Failed. Credits were refunded." : "Still creating…"}
                </div>
              )}
            </div>
            <div className="mt-2 text-sm font-semibold">{g.template.name}</div>
            <div className="text-xs text-foreground/60">{dateFormat.format(g.createdAt)}</div>
            {g.status === "COMPLETED" ? (
              <a
                href={`/api/generations/${g.id}/video?download=1`}
                className="mt-2 block rounded-full bg-purple py-2 text-center text-sm font-semibold text-foreground"
              >
                Download
              </a>
            ) : g.status === "FAILED" ? (
              <Link
                href={`/templates/${g.template.id}`}
                className="mt-2 block rounded-full border border-foreground/30 py-2 text-center text-sm font-semibold"
              >
                Try Again
              </Link>
            ) : (
              <Link
                href={`/templates/${g.template.id}?g=${g.id}`}
                className="mt-2 block rounded-full border border-foreground/30 py-2 text-center text-sm font-semibold"
              >
                View Progress
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
