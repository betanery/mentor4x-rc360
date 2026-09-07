/** Server-only Outlook transport. OAuth and refresh tokens stay in Lovable. */
export const OUTLOOK_GATEWAY = "https://connector-gateway.lovable.dev/microsoft_outlook/v1.0";

type GatewayRuntime = {
  env: { get(name: string): string | undefined };
  fetch: typeof fetch;
};

export async function outlookFetch(
  path: string,
  init: RequestInit = {},
  runtime: GatewayRuntime = { env: Deno.env, fetch: globalThis.fetch },
) {
  const lovableKey = runtime.env.get("LOVABLE_API_KEY");
  const outlookKey = runtime.env.get("MICROSOFT_OUTLOOK_API_KEY");
  if (!lovableKey || !outlookKey) {
    throw new Error("Conecte o Microsoft Outlook ao projeto no Lovable e configure LOVABLE_API_KEY e MICROSOFT_OUTLOOK_API_KEY no backend.");
  }
  if (!path.startsWith("/users/") || path.includes("..") || path.includes("\\")) {
    throw new Error("Caminho de calendário Outlook inválido.");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", outlookKey);
  headers.set("Content-Type", "application/json");
  const response = await runtime.fetch(`${OUTLOOK_GATEWAY}${path}`, {
    ...init,
    headers,
    redirect: "error",
  });
  // Gateway failures can be plain text/HTML; do not expose upstream bodies or secrets.
  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      throw new Error("A conexão Outlook no Lovable não autorizou o acesso. Verifique o vínculo com o projeto e as permissões da agenda.");
    }
    if (response.status === 429) {
      throw new Error("A agenda Outlook atingiu o limite de consultas. Aguarde um momento e tente novamente.");
    }
    throw new Error(`Falha na agenda Outlook via Lovable (${response.status}).`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { throw new Error("A conexão Outlook no Lovable retornou uma resposta inválida."); }
}
