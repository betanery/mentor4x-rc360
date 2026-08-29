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
