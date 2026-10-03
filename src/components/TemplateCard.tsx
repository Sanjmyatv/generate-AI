import Link from "next/link";
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
      <div className="aspect-[3/4] overflow-hidden rounded-xl bg-gradient-to-br from-violet-500/30 to-pink-500/30 transition group-hover:scale-[1.02]" />
      <div className="mt-2 text-sm font-semibold">{template.name}</div>
      <div className="text-xs text-foreground/60">
        {category ? `${category.name} · ` : ""}
        {template.type === "video" ? "Video" : "Image"} · {template.creditCost}{" "}
        {template.creditCost === 1 ? "Credit" : "Credits"}
      </div>
    </Link>
  );
}
