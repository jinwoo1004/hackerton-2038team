/**
 * Reject a Vercel deployment that would silently use browser-only mock data.
 * @param {Record<string, string | undefined>} env
 */
export function validateDeploymentEnvironment(env = process.env) {
  if (env.VERCEL !== "1") return;
  const value = env.NEXT_PUBLIC_API_BASE_URL;
  let url;
  try { url = new URL(value); } catch { /* Report a configuration error without echoing input. */ }
  if (!url || url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/" || value !== value.trim() ||
      url.hostname === "localhost" || url.hostname.endsWith(".localhost") ||
      url.hostname === "[::1]" || /^(127\.|0\.)/.test(url.hostname)) {
    throw new Error("Vercel deployment requires NEXT_PUBLIC_API_BASE_URL to be the public HTTPS origin of the deployed Spring Boot backend (no credentials, path, query, or fragment). Browser mock mode is local-only.");
  }
}
