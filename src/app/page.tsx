import { TemplateCard } from "@/components/TemplateCard";
import { getHomeSections } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sections = await getHomeSections();

  return (
    <>
      <section className="py-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Create amazing AI content
          <br />
          from your photos.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-foreground/70">
          Choose a template, upload your photo, and let AI do the rest.
        </p>
        <a
          href="#templates"
          className="mt-6 inline-block rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
        >
          Explore Templates
        </a>
      </section>

      <div id="templates" className="space-y-10">
        {sections.map(({ category, templates }) => (
          <section key={category.id}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">
              {category.name}
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {templates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  category={sections.find((s) => s.category.id === t.categoryId)?.category}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
