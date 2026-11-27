export interface ProfessionalCompletionInput {
  professionalRegistrationCompleted: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  professionalProfile: { verificationStatus: string } | null;
}

export function getProfessionalCompletion(user: ProfessionalCompletionInput) {
  const documents = user.professionalRegistrationCompleted;
  const contacts = user.emailVerified && user.phoneVerified;
  const status = user.professionalProfile?.verificationStatus;
  const submitted = status === "PENDING" || status === "APPROVED";
  const completed = 1 + Number(documents) + Number(contacts) + Number(submitted);
  const next = !documents ? { href: "/cadastro/profissional/identidade", label: "Enviar documento e selfie" }
    : !contacts ? { href: "/cadastro/profissional/contatos", label: "Confirmar meus contatos" }
    : !submitted ? { href: "/profissional/perfil#verification-status-title", label: status === "REJECTED" ? "Revisar e reenviar meu perfil" : "Enviar meu perfil para análise" }
    : null;
  return { documents, contacts, submitted, completed, next };
}
