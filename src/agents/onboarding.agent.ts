import { config } from "../config";

// ---------------------------------------------------------------------------
// Onboarding Agent
// ---------------------------------------------------------------------------

class OnboardingAgent {
  async handle(userId: string, phone: string, _text: string): Promise<string> {
    const registrationUrl = `${config.dashboardUrl}/onboarding`;
    return (
      `Para configurar o seu perfil, aceda ao formulário de registo:\n${registrationUrl}\n\n` +
      `Após preencher, receberá uma mensagem de boas-vindas aqui. 🎯`
    );
  }
}

export const onboardingAgent = new OnboardingAgent();
