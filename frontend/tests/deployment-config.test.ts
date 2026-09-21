import assert from "node:assert/strict";
import test from "node:test";
import { validateDeploymentEnvironment } from "../scripts/validate-deployment.mjs";

test("local frontend-only demo and local API builds remain available", () => {
  assert.doesNotThrow(() => validateDeploymentEnvironment({}));
  assert.doesNotThrow(() => validateDeploymentEnvironment({ NEXT_PUBLIC_API_BASE_URL: "http://localhost:18080" }));
});

test("Vercel production and previews reject missing or non-public API configuration", () => {
  for (const VERCEL_ENV of ["production", "preview"]) {
    for (const value of [undefined, "", "not-a-url", "http://api.example.com", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://user:password@api.example.com", "https://api.example.com/api", "https://api.example.com?token=secret", "https://api.example.com#fragment"]) {
      assert.throws(() => validateDeploymentEnvironment({ VERCEL: "1", VERCEL_ENV, NEXT_PUBLIC_API_BASE_URL: value }), /public HTTPS origin/);
    }
  }
});

test("Vercel accepts an explicit HTTPS backend origin without model requests", () => {
  assert.doesNotThrow(() => validateDeploymentEnvironment({ VERCEL: "1", NEXT_PUBLIC_API_BASE_URL: "https://api.example.com" }));
  assert.doesNotThrow(() => validateDeploymentEnvironment({ VERCEL: "1", NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/" }));
});
