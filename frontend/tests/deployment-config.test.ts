import assert from "node:assert/strict";
import test from "node:test";
import { validateDeploymentEnvironment } from "../scripts/validate-deployment.mjs";
import { resolveDataMode } from "../src/shared/config/dataMode.mjs";

test("frontend-only production and previews build without a backend and ignore stale URLs", () => {
  for (const VERCEL_ENV of ["production", "preview"]) {
    for (const NEXT_PUBLIC_DATA_MODE of [undefined, "mock"]) {
      for (const NEXT_PUBLIC_API_BASE_URL of [undefined, "", "https://retired.example.com", "http://localhost:8080"]) {
        assert.doesNotThrow(() => validateDeploymentEnvironment({ VERCEL: "1", VERCEL_ENV, NEXT_PUBLIC_DATA_MODE, NEXT_PUBLIC_API_BASE_URL }));
      }
    }
  }
});

test("backend access is explicit and mode typos fail", () => {
  assert.equal(resolveDataMode(undefined), "mock");
  assert.equal(resolveDataMode("api"), "api");
  for (const mode of ["MOCK", "production", "mock "]) {
    assert.throws(() => validateDeploymentEnvironment({ NEXT_PUBLIC_DATA_MODE: mode }), /must be mock or api/);
  }
  assert.throws(() => validateDeploymentEnvironment({ NEXT_PUBLIC_DATA_MODE: "api" }), /backend origin/);
  assert.doesNotThrow(() => validateDeploymentEnvironment({ NEXT_PUBLIC_DATA_MODE: "api", NEXT_PUBLIC_API_BASE_URL: "http://localhost:18080" }));
});

test("explicit Vercel API mode rejects missing or non-public backend configuration", () => {
  for (const VERCEL_ENV of ["production", "preview"]) {
    for (const value of [undefined, "", "not-a-url", "http://api.example.com", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://user:password@api.example.com", "https://api.example.com/api", "https://api.example.com?token=secret", "https://api.example.com#fragment"]) {
      assert.throws(() => validateDeploymentEnvironment({ NEXT_PUBLIC_DATA_MODE: "api", VERCEL: "1", VERCEL_ENV, NEXT_PUBLIC_API_BASE_URL: value }), /public HTTPS origin/);
    }
  }
});

test("Vercel accepts an explicit HTTPS backend origin without model requests", () => {
  assert.doesNotThrow(() => validateDeploymentEnvironment({ NEXT_PUBLIC_DATA_MODE: "api", VERCEL: "1", NEXT_PUBLIC_API_BASE_URL: "https://api.example.com" }));
  assert.doesNotThrow(() => validateDeploymentEnvironment({ NEXT_PUBLIC_DATA_MODE: "api", VERCEL: "1", NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/" }));
});
