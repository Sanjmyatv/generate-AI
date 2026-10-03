import { getCreditPackages } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const creditPackages = await getCreditPackages();

  return (
    <div className="py-10">
      <h1 className="text-center text-3xl font-bold">Pricing</h1>
      <p className="mt-2 text-center text-foreground/70">
        Buy credits to generate images and videos.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {creditPackages.map((pkg) => (
          <div key={pkg.id} className="rounded-2xl border border-foreground/15 p-6">
            <h2 className="text-lg font-semibold">{pkg.name}</h2>
            <p className="mt-2 text-3xl font-bold">
              {pkg.priceMnt.toLocaleString("en-US")}₮
            </p>
            <p className="mt-2 text-sm text-foreground/70">{pkg.credits} credits</p>
            <button className="mt-6 w-full rounded-full bg-foreground py-3 font-semibold text-background">
              Buy Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
