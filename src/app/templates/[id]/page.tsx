import { notFound } from "next/navigation";
import { auth, enabledProviders } from "@/auth";
import { GenerateFlow } from "@/components/GenerateFlow";
import { getTemplate } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ g?: string }>;
}) {
  const [{ id }, { g }] = await Promise.all([params, searchParams]);
  const [template, session] = await Promise.all([getTemplate(id), auth()]);
  if (!template) notFound();

  return (
    <GenerateFlow
      template={template}
      isAuthenticated={Boolean(session?.user?.id)}
      providers={enabledProviders}
      resumeId={g}
    />
  );
}
