# 독립 최종 검증 — session-monitor

> 이 문서는 AI 연결 분리 전 커밋 `9851a58`의 검증 기록이다. 아래의 API key 실행 안내는 현재 로컬 설정에 적용하지 않는다. 현재 설정은 [AI 연결 사용법](AI-CONNECTION.md), 이번 변경의 결과는 [LLM 검증](LLM-VERIFICATION.md)을 따른다.

검증일: 2026-09-21 KST. 검증자는 제품 구현에 참여하지 않았고 `scripts/verification/`, 이 문서와 `docs/evidence/`만 작성했다. 원본 기준은 `8d4d5ce`, 최종 제품 소스 동결 시각은 18:29:13.892다. 동결 후 독립 재빌드한 Full/Frontend BUILD_ID 시각은 각각 18:31:21, 18:31:39다.

**전체 goal 판정: UNVERIFIED / 미완료.** 실제 OpenAI 호출, 보호된 원본 규격 본문 반영, 기본 포트에서의 깨끗한 기동은 실증하지 못했다. 이를 PASS나 전체 완료로 표현하지 않는다. **실행 가능한 합성 입력·LOCAL 폴백 시연 경로는 Full과 Frontend 단독 모두 PASS**다. Slack은 채널이 없는 조건이므로 외부 발송 대신 실제 미리보기 경로를 검증했다.

## 기능 1~11 판정

| 기능 | 실제 실행과 증거 | 실제 결과 | 판정 |
|---|---|---|---|
| 1. 규칙 문서 실제 파싱 | 양 모드에서 5단계 마법사를 클릭해 `wallpad-source.zip`과 `rules.pdf`, `rules.xlsx`, `rules.docx`를 각각 실제 업로드. 기본 MD seed도 별도 확인. `browser.cjs`, 양 모드 `analysis-*` 화면 및 JSON | PDF 본문, Excel 셀, Word 문단에서 `Do not use console.log`를 읽고 문서명·인용·`src/WallpadClient.ts:5` finding 표시. PDF의 페이지, XLSX의 sheet 정보도 브라우저 단독에서 인용. 빈 껍데기 결과 아님 | **PASS** (유효 MD/PDF/XLSX/DOCX). 첨부 보호 규격 내용은 별도 **UNVERIFIED** |
| 2. 소스+규칙 결합 | service 문서 형식별 테스트, frontend 동일 코드 규칙 유무 비교 테스트, 양 모드 finding 펼치기 | 금지 console.log/eval, 20줄 함수 기준, 100자 한 줄 기준, camelCase 위반이 코드 위치와 규칙 출처에 연결. 규칙 없는 코드와 있는 코드 결과가 달라짐 | **PASS** |
| 3. GPT 규칙 추출 + 로컬 폴백 | 키 없는 실제 Full/Frontend, `OpenAiContractTest.backend_extracts_cited_rules_and_passes_them_to_analysis_service`, service 구조화 규칙 검사 | LOCAL 실제 finding 생성. loopback HTTP 계약에서는 OPENAI 추출 구조화 규칙을 FastAPI에 전달하고 적용. 유효 실 OpenAI 키 없음 | **LOCAL PASS / HTTP 계약 PASS / LIVE UNVERIFIED** |
| 4. mock 만점/빈 finding 제거 | 양 모드 기본 fixture 결과 비교, service/front 빈 입력·정상 코드 회귀 | 같은 MD+소스+두 합성 로그: **69점 D / critical0 warning5 info4 / finding9 / 코드28줄 / 전체29줄 / 가장 긴 파일29줄**. 소스+규칙만 있으면 70점/7finding. 빈 입력은 실패, 무위반 정상 코드는 검사 범위와 0건 근거 명시 | **PASS** |
| 5. Incident AI 설명 | 양 시나리오 카드·저장 insight·Slack 문장 대조, OpenAI HTTP 계약/연결 실패 테스트, 독립503/잘못된JSON/시간초과 검증 | LOCAL 대상서버·120→3200/450ms·Timeout8/2·오류3/24·위험도·근거·가설·권장조치 일치. HTTP 계약 OPENAI 생성 및 연결 실패 LOCAL 경로 확인. 실제 OpenAI 미호출 | **LOCAL PASS / HTTP 계약 PASS / LIVE UNVERIFIED** |
| 6. 안전 장애 트리거 | 실제 버튼 LATENCY/ERROR_SPIKE 각 클릭, 설명이 DOM에 표시될 때까지 측정, 각 반복 클릭 | 최종 Full **106ms / 119ms**, Frontend **200ms / 216ms**. 동일 진행 사건 ID 재사용, 시나리오당 OPEN 1개. 실제 서버 장애 없이 합성 생성 | **PASS** |
| 7. ONLINE Agent·시계열·로그 | 에이전트/로그 화면과 `/monitoring` 서버행 펼치기, CPU/메모리/디스크 SVG path 및 표 확인 | Full 실제 C# `1.0.0-demo` Agent1대 ONLINE, 브라우저 seed Agent1대 ONLINE. 각각3차트와36표행, 최근 합성로그 실표시. Full 시작 시60시드 지표에 C#5초 송신이 추가됨 | **PASS** |
| 8. 프런트 단독 동일 흐름 | backend18080/service18000 종료 상태, 별도 API URL 미설정 production build로 동일 브라우저 검증 | 요청 host는 **localhost:13200만**. 동일69/9/28/29, 규칙 실제 파싱, Agent/차트/로그, 두 trigger/insight/Slack/집계/복구 모두 확인. 초기화 시 WALLPAD만 삭제하고 타 프로젝트3개 보존, 재seed69점/Agent1대 | **PASS** (LOCAL 백업 범위) |
| 9. Slack 미리보기 품질 | 두 시나리오 카드에서 미리보기 버튼, insight 모든 evidence/causes/actions와 문장 대조. 실제 채널 목록 확인 | 동일 서버·응답시간·Timeout/오류·근거·원인·조치가 문장에 포함. **외부 발송 아님** 명시. 등록 채널0개로 실제 전송 조건 미충족 | **PASS** (미리보기). 실 Webhook 전송은 조건부 미실행 |
| 10. 모니터링/대시보드 상태 | trigger→중복trigger→다른trigger→overview→recover→overview에서 DOM 집계와7일 추이, Full API 양 응답 비교 | 초기1/정상1/주의0/위험0→진행2건·위험1→복구진행0·정상1. 오늘 발생/해결0/0→2/0→2/2. API/화면·양 화면 모두 즉시 동일 | **PASS** |
| 11. demo.ps1 lifecycle | `test-runtime.ps1 -Lifecycle -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000` 독립 실행 | 깨끗한 대체포트 Full 기동, 중복 실행 PID 유지, stop3포트 해제, resetDB삭제, Frontend 단독, 기본3200/8080/8000 각 충돌 거부·기존PID보존, 외부경로거부, orphan회수, PID재사용보호 **9PASS** | **대체포트 PASS / 기본포트 clean start UNVERIFIED** |

## 완료 확인 조건

| 조건 | 실행 결과 |
|---|---|
| Spring Boot `gradlew test --rerun-tasks` | **14/14 PASS**, BUILD SUCCESSFUL, 34초. enum VARCHAR migration, ownership/demo/incident/LLM 계약 회귀 포함 |
| FastAPI pytest | **16/16 PASS**. 제3자 anyio deprecation warning1건, 실패0 |
| Frontend tests / type-check | **10/10 PASS**, type-check exit0. 최종 longestFiles 행수 회귀 포함 |
| Next production build | **두 모드 PASS**, 각각19/19 정적 페이지 생성. 최종 수정 이후 독립 재빌드 |
| .NET tests / solution build | **27/27 PASS**, Worker/WPF/Tests Release solution build 경고0·오류0 |
| OpenAI 장애 경계 | 실제 제품 `OpenAiClient`에 loopback HTTP503→101ms, malformedJSON→8ms, 1초 timeout→1001ms에 빈 결과 반환. 호출자의 LOCAL fallback 및 생성 결과 근거 보존은 Gradle 계약 테스트로 별도 검증. **실 OpenAI 검증이 아님** |
| `/api/health`, `/api/system/status` | UP 및 api/db/analysis/agent 모두UP. `api.json`, 최종 `ready.json` |
| 프로젝트 소유권 | 다른 신규 합성 계정으로 프로젝트/파일/analysis/agents/metrics/logs 및 demo trigger/recover/token 총9경로 **404**. `api.cjs` |
| 프로젝트 코드 불변 | 생성 후 PUT에 다른 projectCode를 넣어도 기존 코드 유지. 임시 프로젝트만 삭제 |
| 비밀값 | 추적381파일 중 텍스트 파일 및 runtime 로그에서 실제형태 OpenAI/JWT/Agent/Slack credential 패턴0건. 출력·스크린샷의 실제 Agent credential 없음; 화면 token prefix도 마스킹. 이 제한된 패턴 검사는 모든 비밀값 부재에 대한 수학적 보증이 아님 |
| 1440×900 전체 클릭 동선 | 로그인, 프로젝트, 5단계마법사, 규칙+ZIP실업로드, 개요/분석/에이전트/로그/파일/설정, 모니터링, Slack미리보기, 이벤트, 전체분석, 알림설정 양모드 확인 |
| 브라우저 오류 | 양 모드 pageerror0, console error0, HTTP4xx/5xx0, 실패한 network요청0. navigation취소 `ERR_ABORTED`는 정상 취소로 구분 |
| 5분 핵심 동선 | 최종 자동클릭 기준 Full **9.258초**, Frontend **15.341초**. 로그인→분석/인용→Agent/로그/세 자원차트→두trigger/설명/Slack→복구/집계 포함. 문서의5분 발표에 필요한 대기시간은 충족하나 **사람의 대본 낭독 리허설을 측정한 값은 아님** |
| 디자인 회귀 | 원본 대비 Tailwind토큰, shared/ui, widgets/layout, JDK/Gradle구성 변경0. 신규카드 기존 Card/Button/색상/간격 재사용. 로그인·마법사·분석·자원·AI/Slack 화면 직접 시각검토에서 겹침/잘림/새 디자인체계 없음. 기존외부font→동일Pretendard/Nanum로컬font 제공은 MAIN 승인범위. 외부CDN을 못읽은 원본3200 캡처의fallbackfont와 픽셀동일하다고 주장하지 않음 |

## 독립 검증에서 발견하고 수정한 문제

동일 파일의 Frontend `source.totalLines=29`와 `largestFiles.lines=30`이 달랐다. 검증자가 MAIN과 web-app 담당자에게 보고했고, 담당자가 한 줄 집계 로직만 정리했다. LF/CRLF/마지막개행/추가빈줄/빈파일 테스트가 추가됐다. 최종 두 production build와 브라우저에서 가장 긴 파일29줄·코드28줄·점수69를 다시 확인했다. 검증자는 제품 소스를 수정하지 않았다.

초기 자동화에서 한글 버튼 문구/비동기 로딩 선택자가 맞지 않아 실패한 실행은 검증 스크립트만 보정했다. 최종 PASS JSON은 최신 동결 소스 실행으로 덮어썼고 오래된 failure 캡처와 일회성 probe는 제거했다. 마법사 분석 완료 직후의 프로젝트/이력 배지는 별도 비동기 응답으로 잠깐 이전 상태가 보일 수 있으며 결과 수치 검증은 완료 결과에 대해 수행했다.

## 미검증 조건과 재검증 방법

1. **실 OpenAI: UNVERIFIED.** 사용 가능한 `OPENAI_API_KEY`가 없어 라이브 규칙 추출/IncidentInsight 생성은 미실행. 키를 backend 실행 환경에 넣고 Full을 재시작한 뒤 실제 문서와 사건에서 source=OPENAI, 인용finding, 근거/카드/Slack 일치 및10초 제한을 다시 확인해야 한다. 모의 HTTP 통과를 이 조건의 대체로 인정하지 않는다.
2. **첨부 원본 규격 본문: UNVERIFIED.** 원본 `단지서버_월패드_연동_규격.docx`는 OLE EncryptedPackage/DRM이며 독립 파서도 본문 없음·보호되지 않은 사본 필요라는 명시적 오류를 반환했다. 보호 해제된 일반 DOCX/PDF가 있어야 해당 실제 규약 반영을 검증할 수 있다. 현재 fixture는 합성 규칙이며 원본 규격이라고 표시하지 않는다.
3. **기본3200/8080/8000 clean start: UNVERIFIED.** 해당 포트는 별도 사용자 프로토타입이 점유한다. 이를 종료/변경하지 않았고 충돌거부와 기존PID유지를 검증했다. 깨끗한PC/해당포트가비어있는환경에서 기본명령을 재검증해야 한다. 대체포트 전체 lifecycle은 실제 PASS다.
4. **실 Slack 전송: 조건부 미실행.** 채널0개·실Webhook없음. 현재요구의 미리보기 분기는 PASS이며 Webhook을 제공한 경우에만 외부 테스트발송을 별도로 검증한다.

## 증거와 재현

- [Full 브라우저 실행 증거](evidence/full-browser.json), [Frontend 실행 증거](evidence/frontend-browser.json): 단계별실행·DOM상태·측정시간·오류0·인용·스크린샷목록.
- [실제HTTP 계약/소유권 증거](evidence/api.json), [독립명령 결과](evidence/commands.json), [디자인/비밀값검사](evidence/static.json).
- 대표 화면: [Full PDF인용](evidence/full-analysis-pdf.png), [Frontend PDF인용](evidence/frontend-analysis-pdf.png), [자원차트](evidence/full-resources.png), [AI+Slack](evidence/full-incident-latency.png), [복구후대시보드](evidence/full-dashboard-recovered.png).
- [재현 스크립트 안내](../scripts/verification/README.md), [현장 시연 안내](../DEMO.md).

최종 인계는 대체포트 Full을 켜 두고, WALLPAD-DEMO 한 개·ONLINE Agent 한 대·OPEN incident0의 정상 상태로 준비한다. 최종 상태는 `evidence/ready.json`에 기록한다.
