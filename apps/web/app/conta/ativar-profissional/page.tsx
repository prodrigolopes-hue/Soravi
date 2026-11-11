import type { Metadata } from "next";
import { ActivateProfessionalProfilePage } from "../../../components/account/activate-professional-profile-page";

export const metadata: Metadata = { title: "Ativar perfil profissional | Soravi", description: "Crie seu perfil profissional usando sua conta Soravi atual." };
export default function ActivateProfessionalProfileRoute() { return <ActivateProfessionalProfilePage />; }
