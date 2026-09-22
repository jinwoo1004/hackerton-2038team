import { resolveDataMode } from "../src/shared/config/dataMode.mjs";

/** @param {Record<string, string | undefined>} env */
export function validateDeploymentEnvironment(env = process.env) {
  if (resolveDataMode(env.NEXT_PUBLIC_DATA_MODE) === "mock") return;
  const value = env.NEXT_PUBLIC_API_BASE_URL;
  let url;
  try { url = new URL(value); } catch { /* Report a configuration error without echoing input. */ }
  if (env.VERCEL !== "1") {
    if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("API mode requires NEXT_PUBLIC_API_BASE_URL to be an HTTP(S) backend origin.");
    }
    return;
  }
  if (!url || url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/" || value !== value.trim() ||
      url.hostname === "localhost" || url.hostname.endsWith(".localhost") ||
      url.hostname === "[::1]" || /^(127\.|0\.)/.test(url.hostname)) {
    throw new Error("Vercel API mode requires NEXT_PUBLIC_API_BASE_URL to be the public HTTPS origin of the deployed Spring Boot backend (no credentials, path, query, or fragment). Use NEXT_PUBLIC_DATA_MODE=mock for the frontend-only showcase.");
  }
}
