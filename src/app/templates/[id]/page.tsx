import { notFound } from "next/navigation";
import { auth, enabledProviders } from "@/auth";
import { GenerateFlow } from "@/components/GenerateFlow";
import { getTemplate } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template, session] = await Promise.all([getTemplate(id), auth()]);
  if (!template) notFound();

  return (
    <GenerateFlow
      template={template}
      isAuthenticated={Boolean(session?.user?.id)}
      providers={enabledProviders}
    />
  );
}
