import { getHomeSections } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ sections: await getHomeSections() });
}
