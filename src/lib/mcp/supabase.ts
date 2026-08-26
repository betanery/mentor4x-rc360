import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function supabaseProjectUrl(): string {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) is required");
  return url;
}

function supabasePublishableKey(): string {
  const direct = configuredEnv([
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys.default, ...Object.values(keys)]
          .find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"))
          ?.trim();
        if (key) return key;
      }
    } catch {
      // Malformed dictionary; fall through to the legacy names.
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEYS, or SUPABASE_ANON_KEY is required");
}

/** Forwards the verified bearer token so RLS runs as the signed-in user. */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function resolveContractScope(
  supabase: ReturnType<typeof supabaseForUser>,
  companyId: string,
  contractId?: string | null,
) {
  if (!contractId) return { contractId: null, contract: null };

  const { data, error } = await supabase
    .from("contracts")
    .select("id, company_id, status, journey_stage, current_cycle, product_id, product_version_id")
    .eq("id", contractId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Contratação não encontrada ou sem acesso para esta empresa.");

  return { contractId: data.id, contract: data };
}

export function applyContractScope(
  query: any,
  contractId: string | null,
): any {
  return contractId ? query.eq("contract_id", contractId) : query.is("contract_id", null);
}

export function notAuthenticated() {
  return {
    content: [{ type: "text" as const, text: "Não autenticado. Conecte-se ao MENTOR 4X novamente." }],
    isError: true,
  };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

/** Paginação simples por offset codificado em cursor opaco. */
export function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Cursor inválido. Use o valor `next_cursor` devolvido na página anterior.");
  }
  return parsed;
}

export function pageBounds(limit?: number, cursor?: string) {
  const size = Math.min(Math.max(limit ?? 50, 1), 200);
  const offset = decodeCursor(cursor);
  return { size, offset, from: offset, to: offset + size - 1 };
}

export function pageMeta<T>(rows: T[], size: number, offset: number) {
  const hasMore = rows.length > size;
  const page = hasMore ? rows.slice(0, size) : rows;
  return {
    page,
    pagination: {
      limit: size,
      returned: page.length,
      has_more: hasMore,
      next_cursor: hasMore ? String(offset + size) : null,
    },
  };
}
