import { getCreditPackages } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ packages: await getCreditPackages() });
}
