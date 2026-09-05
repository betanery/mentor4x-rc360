import { toast } from "sonner";

/**
 * Mensagens de falha padronizadas em pt-BR: título curto do que aconteceu
 * + orientação do que fazer. Nunca expõe o texto cru do backend em inglês.
 */
export function showError(action: string, error?: unknown, hint?: string) {
  const fallback = "Tente novamente em instantes. Se persistir, avise o Consultor 4X.";
  const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const isPortuguese = /[ãáâàéêíóôõúç]/i.test(detail);
  toast.error(`Não foi possível ${action}`, {
    description: hint ?? (isPortuguese && detail ? detail : fallback),
  });
  if (detail) console.error(`[${action}]`, detail);
}

export function showSuccess(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}

/**
 * Traduz as falhas de login/senha do serviço de autenticação para pt-BR,
 * sempre com orientação do próximo passo.
 */
export function authErrorMessage(error?: unknown): { title: string; description: string } {
  const raw = (error instanceof Error ? error.message : typeof error === "string" ? error : "").toLowerCase();
  if (raw.includes("invalid login credentials")) {
    return { title: "E-mail ou senha incorretos", description: "Confira os dados e tente novamente. Se esqueceu a senha, peça um novo convite ao seu Consultor 4X." };
  }
  if (raw.includes("email not confirmed")) {
    return { title: "Conta ainda não confirmada", description: "Abra o e-mail de convite do Mentor 4X e confirme seu acesso antes de entrar." };
  }
  if (raw.includes("user not found")) {
    return { title: "Conta não encontrada", description: "O acesso é por convite. Fale com seu Consultor 4X ou administrador." };
  }
  if (raw.includes("too many requests") || raw.includes("rate limit")) {
    return { title: "Muitas tentativas seguidas", description: "Aguarde alguns minutos antes de tentar entrar de novo." };
  }
  if (raw.includes("password") && (raw.includes("weak") || raw.includes("short") || raw.includes("pwned") || raw.includes("compromis"))) {
    return { title: "Senha insegura", description: "Escolha uma senha mais forte, com ao menos 8 caracteres e que você não use em outros sites." };
  }
  if (raw.includes("unsupported provider")) {
    return { title: "Entrada com Google indisponível", description: "Use e-mail e senha por enquanto e avise o administrador." };
  }
  if (raw.includes("network") || raw.includes("failed to fetch")) {
    return { title: "Sem conexão com o sistema", description: "Verifique sua internet e tente novamente em instantes." };
  }
  return { title: "Não foi possível entrar", description: "Tente novamente em instantes. Se persistir, avise o Consultor 4X." };
}

