import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Нууцлалын бодлого | zyro.ai" };

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
