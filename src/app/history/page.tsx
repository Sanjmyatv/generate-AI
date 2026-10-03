import { mockHistory } from "@/lib/mock-data";

export default function HistoryPage() {
  const items = [...mockHistory].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );

  return (
    <div className="py-10">
      <h1 className="text-3xl font-bold">History</h1>
      {items.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="font-semibold">Your creations will appear here.</p>
          <p className="text-sm text-foreground/60">
            Choose a template and create your first AI masterpiece.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {items.map((g) => (
            <li key={g.id}>{g.templateId}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
