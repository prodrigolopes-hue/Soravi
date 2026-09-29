import type { Metadata } from "next";

import { ProfessionalProfilePage } from "../../../components/professional/professional-profile-page";

export const metadata: Metadata = {
  title: "Meu perfil profissional | Soravi",
  description: "Atualize as informações do seu perfil profissional na Soravi.",
};

export default function ProfessionalProfileRoute() {
  return <ProfessionalProfilePage />;
}
