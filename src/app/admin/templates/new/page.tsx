import { TemplateForm } from "@/components/admin/TemplateForm";
import { prisma } from "@/lib/db";
import { defaultFormValues } from "@/lib/template-admin";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  return (
    <>
      <h1 className="pt-6 text-2xl font-bold">New template</h1>
      <TemplateForm initial={defaultFormValues()} categories={categories} />
    </>
  );
}
