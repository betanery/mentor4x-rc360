import { supabase } from "@/integrations/supabase/client";

/** Validade curta dos links assinados (Fase 6c) — renovação sob demanda. */
export const SIGNED_URL_TTL = 300;

/**
 * Extrai o caminho interno do arquivo dentro do bucket.
 * Aceita caminhos puros (novo padrão) e URLs assinadas antigas (compatibilidade).
 * Retorna null quando o valor é um link externo (YouTube, Vimeo, Drive...).
 */
export function storagePath(bucket: string, value: string): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  try {
    const u = new URL(value);
    const marker = `/storage/v1/object/`;
    const i = u.pathname.indexOf(marker);
    if (i === -1) return null;
    const rest = u.pathname.slice(i + marker.length).replace(/^(sign|public|authenticated)\//, "");
    if (!rest.startsWith(`${bucket}/`)) return null;
    return decodeURIComponent(rest.slice(bucket.length + 1));
  } catch {
    return null;
  }
}

/** Gera um link assinado curto sob demanda. Links externos são devolvidos como estão. */
export async function signedUrl(bucket: string, value: string | null, ttl = SIGNED_URL_TTL): Promise<string | null> {
  if (!value) return null;
  const path = storagePath(bucket, value);
  if (!path) return value; // link externo
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Abre o arquivo em nova aba com link assinado recém-gerado. */
export async function openStorageFile(bucket: string, value: string | null): Promise<boolean> {
  const url = await signedUrl(bucket, value);
  if (!url) return false;
  window.open(url, "_blank", "noopener");
  return true;
}
