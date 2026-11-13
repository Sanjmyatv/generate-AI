import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { ABOUT } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Бидний тухай | zyro.ai" };

export default function AboutPage() {
  return <LegalPage doc={ABOUT} />;
}
