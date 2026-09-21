# AI runtime/provider 분리 — 독립 검증

판정: **runtime/provider 분리와 비용 없는 자동 회귀 PASS. 실제 Codex OAuth 최소 structured smoke PASS(MAIN 수행). 실제 배포 API와 live 업무 생성은 UNVERIFIED**. 2026-09-21 최종 SSE·진단 인코딩 수정 이후 session-monitor가 전체 backend 61개, 경계 49개, 셸 설정 21개, 실제 자식 환경 8개, JAR 4개, 진단 2개, 수명주기 9개 및 양 모드 브라우저 회귀를 직접 실행했다. 검증자는 제품 코드를 수정하지 않았다. 이전 MVP 검증은 커밋 `9851a58`의 [VERIFICATION.md](VERIFICATION.md)에 남아 있으며 그때의 미검증 조건을 이번 결과로 대체하지 않는다.

## 요구 해석과 검증 경계

최신 사용자 요청의 비밀값을 제거한 사본과 MAIN 전달 내용을 대조했다. 기존 앱은 규칙 추출과 incident 설명을 구조화 JSON으로 받아 정적 검사와 설명 카드에 연결한다. 사용자 화면에 실시간 토큰 스트림, 대화 이력, 모델의 도구 실행을 새로 추가하는 요구는 없다. 공통 인터페이스와 두 HTTP adapter는 이 실제 사용 범위를 보존해야 한다.

- `local → codex_oauth`, `deployed → openai_api`, `test → network-free mock`을 명시적으로 검증한다. `test`의 provider를 테스트 전용 `mock` 값으로 요구하는 MAIN 해석은 테스트 경로를 추측 없이 표현하기 위한 것으로 구분한다.
- local의 `OPENAI_API_KEY` 존재 여부는 라우팅과 무관하며 OAuth 실패 후 유료 API 전환을 허용하지 않는다. deployed는 OAuth 파일 내용뿐 아니라 존재 여부/stat도 검사하지 않아야 한다.
- 기존 결정적 LOCAL 규칙/설명은 비용 없는 비AI 결과로 유지할 수 있다. adapter 오류는 typed error로 보존하고 재로그인이 필요한 실패를 운영자 명령에서 구분할 수 있어야 한다. 설정 오류는 LOCAL 성공으로 덮지 않고 네트워크 이전에 실패한다.
- 자동 검증은 합성 토큰·loopback stub·mock만 사용했다. 배포 API 호출, 사용자가 제공한 프로모션 값의 사용/저장/출력, 기존 Codex 인증 파일 복제를 하지 않았다. 실제 OAuth 호출은 MAIN이 전용 외부 로그인으로 별도 수행한 결과다.
- 진단의 정상 출력은 runtime/provider/model/authConfigured 네 필드로 제한한다. 오류 안내는 고정된 안전한 코드·문구로 판정하며 실제 키, 토큰, auth 파일 내용, upstream 오류 원문을 남기지 않는다.

공식 문서는 ChatGPT 구독 인증과 사용량 기반 API 키 인증을 구분하며, 파일 저장 자격증명은 CODEX_HOME 아래 auth.json에 기록될 수 있다고 설명한다. 이번 구현에서는 사용자 요구에 따라 기존 인증을 복사하지 않고 별도 로그인을 사용한다. [공식 인증 문서](https://learn.chatgpt.com/docs/auth)

Responses HTTP streaming은 SSE의 의미 있는 이벤트를 사용한다. 텍스트 delta 수신만으로 요청 성공을 판정하지 않고 최종 완료·실패를 구분한다. 이것이 Codex 전용 backend endpoint의 범용 API 호환 보장을 의미하지는 않는다. [공식 streaming 문서](https://developers.openai.com/api/docs/guides/streaming-responses)

## 최종 판정표

| ID | 요구/실행 방법 | PASS 기준 | 현재 |
|---|---|---|---|
| C01 | runtime/provider 조합·누락·오타, JAR의 Spring alias 우회 검사 | 허용3조합만 선택하고 그 외는 HTTP 이전 실패 | PASS: 환경 lookup guard, 명시 설정 검사. selector 없이 `--app.llm.runtime=deployed`를 줘도 exit2, Spring/DB 시작0 |
| C02 | local에 API sentinel와 합성 OAuth 동시 설정, endpoint spy | OAuth만 사용, API 설정 조회·API 요청0 | PASS: OPENAI 환경 조회 시 테스트가 실패하도록 검증. 고정 OAuth HTTPS endpoint, production JAR에 같은 구현 포함 |
| C03 | OAuth401/403/429/404/500·timeout | typed 오류·고정 안내, API 전환0 | PASS: 각각 LOCAL_AUTH_REQUIRED/ACCESS_DENIED/RATE_LIMITED/MODEL_UNAVAILABLE/HTTP_ERROR/TIMEOUT, OAuth1회·paid0회 |
| C04 | deployed의 CODEX 환경 조회 guard와 생성 경로 검토 | 일반 Responses API만 사용, OAuth 파일 read/stat 및 네트워크0 | PASS: CODEX 조회 시 실패하는 테스트, OAuth root=null로 정상 API adapter 실행. deployed 경로에 auth reader/파일 연산 없음 |
| C05 | deployed 키 누락, 잘못된 OAuth 경로 동시 설정 | OAuth fallback 없이 네트워크 전 실패 | PASS: unit guard 및 패키징 JAR에서 API_KEY_REQUIRED exit3, OAuth 경로를 해석하지 않음 |
| C06 | test/mock 환경과 자격증명 조회 guard | 실 HTTP0, mock 구분, 실 인증 접근0 | PASS: mock 모델명 `mock-structured`, authConfigured=false, smoke만 고정 응답. 업무 호출은 MOCK_UNAVAILABLE→명시적 LOCAL 결과 |
| C07 | structured provider의 기존 규칙·incident caller 계약 | 인용과 코드 매핑, 관찰값 보존, 오류 일관 | PASS: OpenAiContractTest 2개 및 Full 브라우저. 실제 모델 업무 생성 품질 검증은 아래 L03과 구분 |
| S01 | 한글·emoji를 1바이트씩, CRLF/event/data 경계 분할 | 같은 텍스트/JSON, 완성 한 번 | PASS: 4바이트 UTF-8 포함. terminal 뒤 같은 chunk/다중 ByteBuffer의 부분 UTF-8도 결과에 섞이지 않음 |
| S02 | comment/다중 data/delta/item.done/completed 조합 | 누적 순서·중복·완료 출력 검증 | PASS: completed.output missing/null/[]는 done 사용, nonempty 출력은 정합성 비교. optional index/id, reasoning 검증, 중복·gap·충돌 거절 |
| S03 | failed/incomplete/error/EOF·빈 JSON | 미완료 결과를 성공으로 반환하지 않음 | PASS: typed 오류, CR/LF/CRLF의 빈 프레임 경계 없는 EOF 거절. 빈/공백 JSON·SSE도 NPE 없이 INVALID_RESPONSE |
| S04 | 헤더 후 slow body·무응답·cancel·interrupt | 전체 deadline과 작업 종료, API 전환0 | PASS: subscriber/future 취소, interrupt 상태 보존, 크기 제한, terminal 수신 시 HTTP EOF를 기다리지 않고 종료 |
| A01 | 합성 auth A→B를 같은 provider에서 교체 | 재시작 없이 다음 요청에 B, 자체 refresh0 | PASS: 계정 순서 first→second 확인, 만료/손상/삭제 뒤 추가 transport 호출0 |
| A02 | 미존재/손상/API auth/만료/경로·junction | 안전한 재로그인 오류, 기존 인증 공유 방지 | PASS: 상대경로·repo·기본 Codex·repo alias와 탈출 junction 거절. 합성 expired 진단 exit3, 원문 미출력 |
| R01 | Login명령의 실행파일·인자·자식환경 생성 검사, 합성 경로 정책 검사 | CLI는 login만 사용, 저장소 밖 전용 CODEX_HOME, file-store·ChatGPT 인증, 부모 CODEX_HOME 변경 없음, 기존auth복제0 | PASS: test-config 21개 중 login 인자·전용경로·주입자격증명 제거 검사. 원본 auth 내용 접근0 |
| R02 | Diagnose 정상/오류 및 실제 pwsh 종료코드 | 정상 네 필드, 안전한 오류, 자격증명0 | PASS: JAR mock4필드, typo exit2·합성만료 exit3. ASCII JSON을 파싱한 한글 고정 문구 완전일치, 부모 콘솔 인코딩 유지 |
| R03 | demo local/test child environment, backend/service/frontend/agent 경계 | 자격증명은 필요한 backend/로그인 자식만 받음. API키가 local 추론에 사용되지 않고 frontend/service/agent로 새어나가지 않음 | PASS: 실제 합성 자식8개, 예상변수만 존재·CODEX_HOME 제거·부모변수 보존. shell-boundaries.json |
| R04 | 제공된 launcher의 bind·라우팅·소유권 검사 | loopback, generic OAuth proxy 없음, 앱 인증 유지 | PASS: Full의13200/18080/18000은127.0.0.1. 사용자간9개 API404. 직접 Java 실행에는 문서의 `--server.address=127.0.0.1` 필요; 모든 실행법에서 강제하는 검증은 아님 |
| R05 | 배포 smoke 스크립트를 stub/정적 검토 | 명시된 deployed 설정만 사용. 실배포/API 과금 명령은 자동 테스트에서 호출되지 않음 | PASS: test-config가 명시적 AllowDeployedSmoke 없는 실행을 사전 거절함. 배포 실호출0 |
| P01 | 소스/index/JAR/main build/양 frontend build/runtime logs 검사 | credential 패턴·비공개 인증 산출물 없음 | PASS: [static.json](evidence/llm/static.json)에 대상 수·패턴0·auth/private config 산출물0 기록. 패턴 스캔은 모든 인코딩의 부재 증명은 아님 |
| P02 | 최종 backend61, 경계49, lifecycle9, 양 브라우저13씩 | 기존 기능·구조 보존, 자동 모델 사용량0 | PASS: Full/Frontend 업로드·인용·Agent·로그·자원·장애·Slack preview·복구·집계 검증. 변경 없는 component의 이전 시험은 아래에 별도 명시 |
| L01 | MAIN이 전용 로그인으로 `llm.ps1 -Action Smoke` 실행 | 실제 최소 structured `{ok:true}` 검증 | PASS (MAIN 수행): local/codex_oauth/gpt-6-astra, timeout60, exit0, 안전4필드·authConfigured=true. [live-oauth.json](evidence/llm/live-oauth.json) |
| L02 | 실제 배포 API smoke | 사용자 배포 후 별도 명시 실행용으로 제공. 이번 자동 검증에서는 실행하지 않음 | UNVERIFIED (계획상 미실행) |
| L03 | 실제 업무 문서 규칙 추출·incident 모델 품질 | 별도 실사용 입력과 모델 결과 확인 | UNVERIFIED: 이번 live는 최소 structured smoke만 수행, 업무 통합은 합성 provider/비AI LOCAL 회귀 범위 |

## 증거 수집 방식

HTTP spy는 요청 횟수·선택 provider·고정 오류코드만 기록하며 Authorization 헤더와 요청 본문은 증거 파일에 저장하지 않았다. auth 파일 교체와 CLI 환경 테스트에는 구독/과금 기능이 없는 합성 sentinel만 사용했다. 결과는 `docs/evidence/llm/`에 분리했다. 제품 담당자의 시험 통과 주장과 별개로 session-monitor가 아래 명령을 직접 실행했다.

| 직접 실행한 명령 | 실제 결과·증거 |
|---|---|
| `backend/gradlew.bat --no-daemon --offline --console=plain clean test bootJar` | 61 tests, failure/error/skip0, JAR SHA256 포함 [backend-all.json](evidence/llm/backend-all.json) |
| `scripts/verification/llm-boundaries.ps1` | provider30 + transport10 + SSE7 + caller2 =49 PASS, [backend-boundaries.json](evidence/llm/backend-boundaries.json) |
| `scripts/verification/llm-packaged.ps1` | 패키징 JAR4 PASS, [packaged.json](evidence/llm/packaged.json) |
| `scripts/llm/test-config.ps1`, `scripts/runtime/test-environment.ps1` | 21 + 실제 자식8 PASS, [shell-boundaries.json](evidence/llm/shell-boundaries.json) |
| `scripts/llm/test-diagnostic.ps1` | 설정오류·합성만료2 PASS, [diagnostic.json](evidence/llm/diagnostic.json) |
| `scripts/runtime/test-runtime.ps1 -Lifecycle -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000` | 수명주기9 PASS, [lifecycle.json](evidence/llm/lifecycle.json) |
| `node scripts/verification/api.cjs` | 시스템UP·타인9개route404·projectCode불변, [api.json](evidence/llm/api.json) |
| `node scripts/verification/browser.cjs full`, `... frontend` | 각13검사 PASS, 1440×900, fresh Chrome context, [Full](evidence/llm/full-browser.json) / [Frontend](evidence/llm/frontend-browser.json) |
| `.tools/python311/python.exe scripts/verification/llm-static.py` | 값 미출력 소스/index/산출물/log 스캔, [static.json](evidence/llm/static.json) |

브라우저 재실행은 `VERIFICATION_EVIDENCE_DIR=docs/evidence/llm`, Full backend는 `APP_RUNTIME=test`, `LLM_PROVIDER=mock`으로 명시했다. 자동 검증에서 실제 모델 요청0. 경계 테스트의 모델 transport는 in-memory/Mockito이고, caller 통합의 HTTP는 FastAPI 계약을 흉내 낸 loopback stub뿐이다.

## 동작 회귀와 시각 확인

양 모드의 시드 결과는69점/D, critical0·warning5·info4, finding9, code28줄/total29줄/최장29줄로 일치한다. 실제 PDF/XLSX/DOCX와 ZIP을 5단계 wizard에 올려 `src/WallpadClient.ts:5`와 console.log 원문 인용을 확인했다. Full은 실제 C# 합성 sender1대ONLINE, Frontend는 명시적 브라우저 합성 Agent이며 같은 것으로 주장하지 않는다. CPU/메모리/디스크 차트 및36개 테이블 행을 검사했다.

| 측정 | Full test/mock | Frontend-only |
|---|---:|---:|
| 응답 지연 클릭→설명 표시 | 115ms | 213ms |
| 오류 급증 클릭→설명 표시 | 66ms | 207ms |
| 로그인→시드 분석→Agent/로그→자원→2회 장애·Slack→복구·집계 핵심 자동 동선 | 9.208초 | 16.183초 |
| page / console / network 오류 | 0 / 0 / 0 | 0 / 0 / 0 |
| 캡처 | 29개 | 29개 |

시간은 자동화된 조작의 실측이며, 발표 내레이션 시간이나 실제 모델 응답시간을 뜻하지 않는다. 반복 트리거의 incident ID가 유지되고, 설명·Slack preview의 관찰값과 가능한 원인·조치가 일치했다. 복구 후 위험 프로젝트0/진행incident0, 당일 발생2·해결2가 모니터링과 dashboard에서 일치했다. Frontend 리셋은 WALLPAD만 제거하고 검증 프로젝트3개를 보존한 뒤 같은69점으로 재생성했다.

session-monitor가 Full 분석·incident, Frontend DOCX 분석·복구 dashboard PNG를 직접 열어 레이아웃과 인용 표시를 확인했다. frontend/src·shared UI·Tailwind·Agent·service 소스는 기준커밋 이후 변경0이다. 신규 Frontend 분석 직후 프로젝트/이력 badge가 `분석중`/`대기중`으로 남는 표시는 이전 `docs/evidence/frontend-analysis-docx.png`에도 동일한 기존 한계다. 결과 카드·인용은 완료되어 있으며 이번 LLM 변경에서 새로 생긴 회귀로 분류하지 않았다.

## 이전 시험과 미검증 범위

Frontend10 tests/typecheck/dual build, Python16 tests, .NET27 tests/solution build는 `9851a58`의 이전 검증 기록이다. 이번에는 해당 구현에 변경이 없어 그 unit/build 명령을 반복하지 않았고, 새 backend61 tests와 실제 양 모드 E2E·C# sender·analysis service 계약/상태로 연결 영향을 검증했다.

실 OAuth는 MAIN이 수행했다. 개발 과정5회는 TIMEOUT1회와 INVALID_RESPONSE4회(안전 메타만 확인한2회 포함)였으며 마지막6번째 smoke가 성공했다. 워크스페이스 이름·프로모션 혜택·무제한 사용, 실제 API 과금 경로, 실제 Slack 외부 발송을 검증했다고 주장하지 않는다. 보호된 원본 DOCX의 본문과 기본 포트 clean start에 대한 이전 UNVERIFIED도 유지한다. 유효한 합성 DOCX 업로드 PASS와 보호 문서 해독은 다른 범위다.

독립 검토로 빈 JSON의 NPE 가능성, 불필요한 CODEX_HOME 자식 상속을 보고했고 각 담당자가 수정했다. MAIN 실 OAuth 확인으로 드러난 `output_item.done` 조립/빈 completed output/HTTP EOF 대기와 진단 인코딩도 담당자가 보완했다. 최종61/49개 시험은 이 보완 이후 결과다. 수정 전60개 통과는 [별도 이력](evidence/llm/backend-all-before-completion-fix.json)으로만 남겼다.

## 인계

브라우저 검증 후 `Stop`만 실행해 `.demo/data/monitoring.mv.db`의 기존 COMPLETED 시드를 보존했다. 검증용13200/18080/18000 listener0을 확인하고 MAIN에 제어를 넘겼다. 원본 사용자 앱3200/8080/8000 PID는 검증 전후 각각14372/13104/9764로 동일하다. [handoff.json](evidence/llm/handoff.json)

MAIN이 이후 local/codex_oauth/gpt-6-astra Full을13200/18080/18000에 재기동하고 GET만으로 healthUP·기존COMPLETED69점 재사용을 확인했다. [local-ready.json](evidence/llm/local-ready.json) 이 인계 실행은 기본 timeout4초이며, 앞선 live 최소 smoke의60초와 구분한다. 새 analysis/incident trigger를 실행하지 않아 추가 generate 요청은 없었다. 최종 Git stage 뒤 credential scan은 최신 [static.json](evidence/llm/static.json)과 MAIN의 최종 index 검사로 확인한다.
