export const PUBLIC_BACKEND_FALLBACK = Object.freeze({
  url: "https://fjgdcmtwstmslmbxlsga.supabase.co",
  projectId: "fjgdcmtwstmslmbxlsga",
  publishableKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2RjbXR3c3Rtc2xtYnhsc2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NjY5MzMsImV4cCI6MjA5MjU0MjkzM30.7UvR_mWHOcmRr1jEyKDWpec5x7L7AQWezHD2vJKbBF0",
});

export function resolvePublicBackend(env = process.env) {
  return {
    url: env.VITE_SUPABASE_URL || PUBLIC_BACKEND_FALLBACK.url,
    projectId: env.VITE_SUPABASE_PROJECT_ID || PUBLIC_BACKEND_FALLBACK.projectId,
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || PUBLIC_BACKEND_FALLBACK.publishableKey,
  };
}
