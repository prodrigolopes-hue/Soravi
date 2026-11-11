export interface RegistrationGuidance {
  title: string | null;
  message: string;
  loginLabel: string;
}

export function registrationGuidance(
  isProfessionalRegistration: boolean,
): RegistrationGuidance {
  return isProfessionalRegistration
    ? {
      title: "Sua conta foi criada!",
      message:
        "Para ficar apto a receber oportunidades, ainda é necessário concluir seu cadastro profissional. Confirme seu e-mail, faça login e siga as orientações para completar as informações e enviar sua identidade para análise. A disponibilidade de oportunidades também depende dos critérios da Soravi e da conclusão das verificações aplicáveis.",
      loginLabel: "Ir para login",
    }
    : {
      title: null,
      message:
        "Cadastro concluído. Confira seu e-mail e a caixa de spam para encontrar o link de confirmação. Se não o receber, solicite um novo link abaixo.",
      loginLabel: "Entrar",
    };
}
