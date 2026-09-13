export interface PublicBackendConfig {
  url: string;
  projectId: string;
  publishableKey: string;
}

export const PUBLIC_BACKEND_FALLBACK: Readonly<PublicBackendConfig>;
export function resolvePublicBackend(env?: Record<string, string | undefined>): PublicBackendConfig;
