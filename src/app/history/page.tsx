import { auth, enabledProviders } from "@/auth";
import { LoginButtons } from "@/components/LoginButtons";

export const dynamic = "force-dynamic";

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

  // TODO: load this user's generations (newest first) once generation is implemented.
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
