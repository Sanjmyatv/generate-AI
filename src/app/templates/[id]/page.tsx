import { notFound } from "next/navigation";
import { GenerateFlow } from "@/components/GenerateFlow";
import { getTemplate } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return <GenerateFlow template={template} />;
}
