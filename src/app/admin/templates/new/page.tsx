import { TemplateForm } from "@/components/admin/TemplateForm";
import { prisma } from "@/lib/db";
import { usdMntRate } from "@/lib/pricing";
import { defaultFormValues } from "@/lib/template-admin";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const [categories, packages] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.creditPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <h1 className="pt-6 text-2xl font-bold">New template</h1>
      <TemplateForm
        initial={defaultFormValues()}
        categories={categories}
        packages={packages}
        usdMnt={usdMntRate()}
      />
    </>
  );
}
