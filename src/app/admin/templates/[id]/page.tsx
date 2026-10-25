import { notFound } from "next/navigation";
import { TemplateForm } from "@/components/admin/TemplateForm";
import { prisma } from "@/lib/db";
import { usdMntRate } from "@/lib/pricing";
import { templateToFormValues } from "@/lib/template-admin";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [template, categories, packages] = await Promise.all([
    prisma.template.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.creditPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!template) notFound();

  return (
    <>
      <h1 className="pt-6 text-2xl font-bold">Edit {template.name}</h1>
      <TemplateForm
        initial={templateToFormValues(template)}
        categories={categories}
        packages={packages}
        usdMnt={usdMntRate()}
        templateId={template.id}
      />
    </>
  );
}
