import type { Metadata } from "next";

import { PublicProfessionalProfilePage } from "../../../components/discovery/public-professional-profile-page";

export const metadata: Metadata = {
  title: "Perfil profissional | Soravi",
  description: "Conheça o perfil público de um profissional na Soravi.",
};

export default async function PublicProfessionalProfileRoute({ params }: { params: Promise<{ professionalProfileId: string }> }) {
  const { professionalProfileId } = await params;
  return <PublicProfessionalProfilePage professionalProfileId={professionalProfileId} />;
}
