import Link from "next/link";
import { TemplatePreview } from "@/components/TemplatePreview";
import type { Category, Template } from "@/types";

export function TemplateCard({
  template,
  category,
}: {
  template: Template;
  category?: Category;
}) {
  return (
    <Link
      href={`/templates/${template.id}`}
      className="group block w-44 shrink-0 sm:w-52"
    >
      <div className="aspect-[3/4] overflow-hidden rounded-xl transition group-hover:scale-[1.02]">
        <TemplatePreview
          src={template.previewUrl}
          alt={template.name}
          className="h-full w-full"
        />
      </div>
      <div className="mt-2 text-sm font-semibold">{template.name}</div>
      <div className="text-xs text-foreground/60">
        {category ? `${category.name} · ` : ""}
        {template.type === "video" ? "Video" : "Image"} · {template.creditCost}{" "}
        {template.creditCost === 1 ? "Credit" : "Credits"}
      </div>
    </Link>
  );
}
