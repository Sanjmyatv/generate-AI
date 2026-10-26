import { notFound } from "next/navigation";
import { auth, enabledProviders } from "@/auth";
import { GenerateFlow } from "@/components/GenerateFlow";
import { getCreditPackages, getTemplate } from "@/lib/queries";
import { getUserById } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function TemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ g?: string }>;
}) {
  const [{ id }, { g }] = await Promise.all([params, searchParams]);
  const [template, session, packages] = await Promise.all([getTemplate(id), auth(), getCreditPackages()]);
  if (!template) notFound();
  const user = session?.user?.id ? await getUserById(session.user.id) : null;

  return (
    <GenerateFlow
      template={template}
      isAuthenticated={Boolean(session?.user?.id)}
      providers={enabledProviders}
      resumeId={g}
      credits={user ? user.credits : null}
      packages={packages}
    />
  );
}
