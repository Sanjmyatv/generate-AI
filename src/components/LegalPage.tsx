import type { LegalDocument } from "@/lib/legal-content";

/** A text page (About, Terms, Privacy): a glass card with numbered sections. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  const body = "text-sm leading-relaxed text-neutral-300 md:text-base";
  return (
    <div className="mx-auto max-w-4xl py-10 md:py-16">
      <article className="space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 backdrop-blur-md md:p-10">
        <header>
          <h1 className="mb-2 text-3xl font-bold text-white md:text-4xl">{doc.title}</h1>
          {doc.updated && <p className="mb-8 text-sm text-indigo-400">{doc.updated}</p>}
          <p className={body}>{doc.intro}</p>
        </header>

        {doc.sections.map((section, i) => (
          <section key={section.heading}>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-white">
              <span className="text-indigo-400">{i + 1}.</span>
              {section.heading}
            </h2>
            {section.intro && <p className={body}>{section.intro}</p>}
            {section.items && (
              <ul className={`${section.intro ? "mt-3 " : ""}list-disc space-y-2 pl-5 marker:text-indigo-400 ${body}`}>
                {section.items.map((item) => (
                  <li key={item.lead ?? item.text}>
                    {item.lead && <strong className="font-semibold text-white">{item.lead}: </strong>}
                    {item.text}
                  </li>
                ))}
              </ul>
            )}
            {section.outro && <p className={`mt-3 ${body}`}>{section.outro}</p>}
          </section>
        ))}
      </article>
    </div>
  );
}
