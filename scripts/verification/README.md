# Independent session-monitor verification

Run from the OUT root after the production sources are frozen. `browser.cjs` uses a fresh isolated Chrome context at 1440×900 and saves sanitized JSON/screenshot evidence. It never exports browser auth state, tokens, request headers or full Agent responses. It creates synthetic verification projects; Full mode deletes only the project IDs created by that run. Frontend mode checks that resetting WALLPAD-DEMO preserves those other projects, then closes its isolated context.

Install/provide Playwright outside production dependencies, or set `PLAYWRIGHT_MODULE` to the module directory. On this verification PC:

```powershell
$env:PLAYWRIGHT_MODULE = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'

# Start Full with the documented alternate ports, then:
node scripts/verification/browser.cjs full
node scripts/verification/api.cjs
node scripts/verification/static.cjs

# Stop Full, start Frontend with the same alternate frontend port, then:
node scripts/verification/browser.cjs frontend
```

Browser scripts expect frontend13200/backend18080. `api.cjs` validates real HTTP ownership and code immutability using a disposable synthetic account and project. `static.cjs` compares protected design/build files against 8d4d5ce and scans tracked text/runtime logs for likely credential literals without printing any values. Pattern scanning is a limited check, not proof of absence of every possible secret.

`visual.cjs` only reads the separately running original prototype's3200/login and captures its screenshot/styles. It never stops or changes that application. Raw original screenshots can use fallback fonts if external font CDNs fail; the OUT font files preserve the intended font families locally.

Runtime lifecycle checks are in `scripts/runtime/test-runtime.ps1`; they stop/reset only recorded OUT processes. Read `docs/VERIFICATION.md` for the actual independent results and explicit UNVERIFIED conditions. HTTP OpenAI contract tests must never be described as live OpenAI verification.

## Runtime/provider boundary verification

The AI runtime/provider change has its own report, `docs/LLM-VERIFICATION.md`, and sanitized evidence under `docs/evidence/llm/`. The earlier `docs/VERIFICATION.md` is the historical MVP record.

After the backend sources and tests are frozen, use PowerShell 7 with Java 17 and an already populated Gradle dependency cache:

```powershell
.\scripts\verification\llm-boundaries.ps1
```

No running application or login is needed. This wrapper launches an isolated child with `APP_RUNTIME=test` and `LLM_PROVIDER=mock`, removes inherited OAuth/API configuration, and invokes Gradle with `--offline`. It runs `LlmProviderBoundaryTest`, `LlmTransportTest`, `LlmSseCompletionTest`, and `OpenAiContractTest`: model transports are in-memory fakes, and the feature contract uses only a loopback service stub. Missing cached build dependencies fail instead of downloading them. It saves only fresh test counts and status to `docs/evidence/llm/backend-boundaries.json`; it does not call `llmSmoke`, the login CLI, or a live model endpoint.

After `bootJar`, run `.\scripts\verification\llm-packaged.ps1` to verify mock Diagnose/Smoke from the packaged JAR, rejection of missing selectors before Spring/database startup, and a missing deployed key with an invalid OAuth path. These checks make no model requests and save `packaged.json`.

The obsolete standalone `LlmBoundaryVerification.java` targeted the removed `OpenAiClient` and is retained only in Git history. The replacement exercises the current structured-provider interface. A real OAuth smoke is a separate, explicitly coordinated manual check; a real deployed API smoke is excluded from automatic verification. Before rerunning browser/incident scenarios after this change, start the application explicitly in `test/mock` so feature actions cannot spend model usage.

For this change, set `$env:VERIFICATION_EVIDENCE_DIR = 'docs/evidence/llm'` before `browser.cjs` or `api.cjs`; this preserves the historical MVP evidence. Run the artifact scan with `.\.tools\python311\python.exe scripts/verification/llm-static.py`. It checks current source, indexed text, first-party build output, the application section of the backend JAR, and runtime logs. Findings contain only paths and pattern names, never matched credentials. Pattern scans cannot prove the absence of every secret encoding.
