import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { TERMS } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Үйлчилгээний нөхцөл | zyro.ai" };

export default function TermsPage() {
  return <LegalPage doc={TERMS} />;
}
