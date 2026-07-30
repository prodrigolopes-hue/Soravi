import { HeroSection } from "../components/home/hero-section";
import { HowItWorks } from "../components/home/how-it-works";
import { ProfessionalCta } from "../components/home/professional-cta";
import { ServiceCategories } from "../components/home/service-categories";

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