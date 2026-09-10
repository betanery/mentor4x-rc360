import { resolvePublicBackend } from "./public-backend-config.mjs";

const config = resolvePublicBackend();
const invalidMarkers = ["your-project", "placeholder", "undefined", "null"];

const problems = Object.entries(config).flatMap(([name, value]) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return [`${name} está vazio`];
  if (invalidMarkers.some((marker) => normalized.includes(marker))) {
    return [`${name} contém um valor de exemplo`];
  }
  return [];
});

if (!config.url.startsWith("https://") || !config.url.endsWith(".supabase.co")) {
  problems.push("url não é um endereço válido do backend");
}

if (config.projectId !== "fjgdcmtwstmslmbxlsga") {
  problems.push("projectId não aponta para o backend do Mentor 4X");
}

if (!config.publishableKey.startsWith("eyJ")) {
  problems.push("publishableKey não tem o formato esperado");
}

if (problems.length > 0) {
  console.error(`Configuração pública de produção inválida:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

console.log("Configuração pública de produção validada.");
