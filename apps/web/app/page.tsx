import type { Metadata } from "next";

import { HeroSection } from "../components/home/hero-section";
import { HowItWorks } from "../components/home/how-it-works";
import { ProfessionalCta } from "../components/home/professional-cta";
import { ServiceCategories } from "../components/home/service-categories";

export const metadata: Metadata = {
  title: "Soravi | Soluções para serviços",
  description:
    "Descreva o que precisa, publique sua solicitação e receba propostas de profissionais na Soravi.",
};

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <ServiceCategories />
      <HowItWorks />
      <ProfessionalCta />
    </main>
  );
}
