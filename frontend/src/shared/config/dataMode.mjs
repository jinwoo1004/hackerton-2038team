/** @param {string | undefined} value @returns {"mock" | "api"} */
export function resolveDataMode(value) {
  if (value === undefined || value === "" || value === "mock") return "mock";
  if (value === "api") return "api";
  throw new Error("NEXT_PUBLIC_DATA_MODE must be mock or api.");
}
