import type { Metadata } from "next";

import { PhoneVerificationForm } from "../../components/auth/phone-verification-form";

export const metadata: Metadata = {
  title: "Verificar telefone | Soravi",
  description: "Confirme seu telefone para continuar na Soravi.",
};

export default function PhoneVerificationPage() {
  return <PhoneVerificationForm />;
}
