export interface RegistrationGuidance {
  message: string;
  loginLabel: string;
}

export function registrationGuidance(
  isProfessionalRegistration: boolean,
): RegistrationGuidance {
  return isProfessionalRegistration
    ? {
      message:
        "Conta profissional criada. Confirme seu e-mail pelo link enviado, depois faça login e conclua seu cadastro profissional. Se não receber o link, confira a caixa de spam ou solicite um novo abaixo.",
      loginLabel: "Ir para login",
    }
    : {
      message:
        "Cadastro concluído. Confira seu e-mail e a caixa de spam para encontrar o link de confirmação. Se não o receber, solicite um novo link abaixo.",
      loginLabel: "Entrar",
    };
}
