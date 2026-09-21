# Independent session-monitor verification

Run from the OUT root after the production sources are frozen. `browser.cjs` uses a fresh isolated Chrome context at 1440×900 and saves sanitized JSON/screenshot evidence. It never exports browser auth state, tokens, request headers or full Agent responses. It creates synthetic verification projects; Full mode deletes only the project IDs created by that run. Frontend mode checks that resetting WALLPAD-DEMO preserves those other projects, then closes its isolated context.

Install/provide Playwright outside production dependencies, or set `PLAYWRIGHT_MODULE` to the module directory. On this verification PC:

```powershell
$env:PLAYWRIGHT_MODULE = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'

# Start Full with the documented alternate ports, then:
node scripts/verification/browser.cjs full
node scripts/verification/api.cjs
node scripts/verification/static.cjs
.\scripts\verification\llm-boundaries.ps1

# Stop Full, start Frontend with the same alternate frontend port, then:
node scripts/verification/browser.cjs frontend
```

Browser scripts expect frontend13200/backend18080. `api.cjs` validates real HTTP ownership and code immutability using a disposable synthetic account and project. `static.cjs` compares protected design/build files against 8d4d5ce and scans tracked text/runtime logs for likely credential literals without printing any values. Pattern scanning is a limited check, not proof of absence of every possible secret.

`visual.cjs` only reads the separately running original prototype's3200/login and captures its screenshot/styles. It never stops or changes that application. Raw original screenshots can use fallback fonts if external font CDNs fail; the OUT font files preserve the intended font families locally.

Runtime lifecycle checks are in `scripts/runtime/test-runtime.ps1`; they stop/reset only recorded OUT processes. Read `docs/VERIFICATION.md` for the actual independent results and explicit UNVERIFIED conditions. HTTP OpenAI contract tests must never be described as live OpenAI verification.
