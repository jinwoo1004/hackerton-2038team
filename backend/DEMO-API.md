# Demo API additions

All endpoints require the existing JWT and preserve project ownership (other users receive 404). `demo` profile alone creates the local `admin@xisnd.com` / `test1234` account and exposes synthetic triggers. Never use that profile for production.

* `POST /api/demo/seed` → `{projectId,agentId,analysisId}`. Registers `WALLPAD-DEMO`, `wallpad-demo-01`, source ZIP, rules.md and synthetic .log files from `APP_DEMO_FIXTURES`, then runs the existing asynchronous FastAPI analysis. Repeated successful seed reuses the records. Poll the existing analysis/latest endpoint until COMPLETED.
* `POST /api/demo/projects/{id}/trigger` with `{scenario:"LATENCY"|"ERROR_SPIKE"}` → existing IncidentResponse plus insight. One open incident per scenario; repeats reuse it. No actual outage or external server call occurs.
* `POST /api/demo/projects/{id}/recover` → `{projectId,resolved,status:"NORMAL"}`. Resolves active synthetic incidents; repeating it is safe.
* `POST /api/demo/projects/{id}/agent-token` → `{agentId,token}`. Authenticated launcher handoff: rotates the existing `wallpad-demo-01` credential while keeping its ID and metrics; the previous token immediately becomes invalid. Missing, foreign or non-demo projects return 404. The response is marked `Cache-Control: no-store`; keep the token in memory and pass it only to the C# child environment. Never print or persist it. This endpoint is available only in the demo profile.
* `GET /api/incidents/{id}/preview` → `{message,externalDelivery:false}`. Uses the same saved incident explanation as Slack dispatch. Existing alert channel test/delivery APIs handle real configured webhooks.

`IncidentResponse.insight`: `source` (LOCAL/OPENAI), `serverName`, nullable `baselineResponseMs/currentResponseMs`, `timeoutCount/errorCount`, `severity`, `summary`, `evidence[]`, `causes[]`, `actions[]`. Observations are persisted as an incident snapshot. Uncollected response times are explicitly described as missing. For normal ingested incidents, recent error/timeout counts are scoped to the incident's server where available. Possibilities are labelled as hypotheses.

The initial seed always writes 60 deterministic metric points. `APP_DEMO_HEARTBEAT_ENABLED=false` disables subsequent backend-generated heartbeat/metrics when the launcher uses actual C# ingestion into that same agent. The default is true for backend-only demonstrations.

`GET /api/dashboard` and `GET /api/monitoring/overview` add `health:{total,normal,warning,critical,openIncidents}` and `incidentTrend:[{date,opened,resolved}]` (7 days). Health counts **projects**, using current OPEN incident severity; existing project registration/analysis status is unchanged.

Rule findings add nullable `ruleSource` / `ruleText`. `rules.extractionSource` is LOCAL/OPENAI. Backend obtains actual extracted document content through FastAPI `/rules/documents`, asks OpenAI for a constrained rule vocabulary, validates verbatim citations, then passes structured rules to FastAPI. Credentials never go to the browser or Python service. Failure/absence of a key uses the local parser. Empty/unreadable source and logs produce FAILED, score 0 with an unmeasured note; a clean scanned source may score 100 with explicit inspection coverage.

OpenAI is configured with environment `OPENAI_API_KEY`, optional `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_TIMEOUT_SECONDS` (default 4s, bounded to 6s). Uses Responses API with `store:false`, strict JSON schema and no body/key logging. [Official structured output documentation](https://developers.openai.com/api/docs/guides/structured-outputs). The offline path requires no key. HTTP stub tests establish request/response/fallback contracts, **not live OpenAI verification**.

PDF text uses pypdf; XLSX uses openpyxl cell values; DOCX uses python-docx paragraphs and tables. Scanned PDFs without text are explicitly unsupported. OLE/DRM/encrypted Office documents are reported as unreadable, never treated as an empty successful ruleset.
