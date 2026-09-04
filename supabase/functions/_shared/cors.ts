const normalize = (value: string) => value.trim().replace(/\/$/, "");
function allowedOrigins(): string[] {
  const configured = (Deno.env.get("APP_ALLOWED_ORIGINS") || "").split(",").map(normalize).filter(Boolean);
  const appUrl = normalize(Deno.env.get("APP_URL") || "");
  if (appUrl && !configured.includes(appUrl)) configured.push(appUrl);
  return configured;
}
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = normalize(req.headers.get("origin") || "");
  const allowed = allowedOrigins();
  const selected = origin && allowed.includes(origin) ? origin : (allowed[0] || "");
  return { ...(selected ? { "Access-Control-Allow-Origin": selected, "Vary": "Origin" } : {}), "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" };
}
export function originAllowed(req: Request): boolean {
  const origin = normalize(req.headers.get("origin") || "");
  if (!origin) return true;
  return allowedOrigins().includes(origin);
}
