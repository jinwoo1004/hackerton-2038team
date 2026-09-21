# 구현 기준과 근거

## 출발점

2026-09-21 원본 ZIP에서 실행 산출물과 기존 Git 이력을 제외한 소스를 OUT에 복원했다. 원본 기준 커밋은 `8d4d5ce`이며 개발 변경 전에 `jinwoo1004/hackerton-2038team`의 main에 push했다. 초기 SSH/HTTPS 인증은 dx-team-lab으로 되어 있었으며 Git Credential Manager에서 jinwoo1004 인증 후 해당 계정의 HTTPS push를 사용했다. 비밀 설정, DB, 업로드 데이터와 실제 토큰은 추적하지 않는다.

사용자의 최종 goal이 상위 AGENTS.md의 기존 범위보다 우선한다. 따라서 OpenAI 연동은 이번 구현에 포함한다. 원본 JDK17, Spring Boot3.3.5/Gradle, Next14/TypeScript/Tailwind, FastAPI, .NET8 구조를 유지한다. Frontend/Agent → Spring Boot → FastAPI 호출 방향을 유지한다.

## 참고 자료 검토

- 발표 PDF는 22페이지를 추출했다. 실제 PDF 14~19페이지는 등록 마법사, 프로젝트 Context, Agent, 분석, 통합 대시보드와 AI 설명 흐름에 해당한다. 발표 대본의 페이지 번호와 최종 PDF의 번호가 일부 다르므로 화면 내용 기준으로 대조한다.
- 이미 구현된 마법사, 프로젝트 탭, 로그인, 공통 UI를 유지한다. AI 설명은 대상 서버, 응답시간 변화, Timeout/오류 수, 위험도, 근거와 권장 조치를 연결한다.
- 원본 로그는 각각 86,384줄과 269,299줄이다. ERROR 문자열 포함 행은 각각 170, 1,361개이며 정규화 이전의 단순 문자열 집계다. `$version`, `$cmd`, `$copy`, `$target` 메시지 형식과 `copy format ERROR` 패턴을 확인했다. 운영 로그를 서비스 시드나 저장소에 복사하지 않았다.
- 첨부 `단지서버_월패드_연동_규격.docx`는 849,920바이트이고 일반 DOCX ZIP 형식이 아니다. OLE 서명과 `EncryptedPackage`/`DataSpaces` 표식을 확인했다. python-docx는 BadZipFile로 실패했다. 매크로를 비활성화한 Word 읽기 전용 접근도 본문을 반환하지 않아 해당 작업의 자동화 프로세스를 종료했다. 규격 본문 추출 및 규칙 반영은 UNVERIFIED이며 접근 가능한 비보호 문서가 필요하다. 파일을 읽지 않고 규칙을 추정하지 않는다.

## 디자인 기준

원본 Tailwind `primary`, `ink`, `toss` 색상, font family, spacing, radius, shadow와 `shared/ui` 컴포넌트가 단일 기준이다. 전면 재설계는 하지 않는다. MAIN의 globals.css 변경은 기존 외부 폰트 import를 동일한 Pretendard Variable v1.3.9와 Nanum Pen Script 로컬 파일로 바꾼 것이다. 색상/레이아웃/타이포그래피 토큰은 유지하며 공개 글꼴 라이선스를 함께 보관한다.

## 공통 API와 합성 시나리오

| 호출 | 계약 |
| --- | --- |
| POST `/api/demo/seed` | 인증된 사용자 데모 준비, `{projectId,agentId,analysisId}` |
| POST `/api/demo/projects/{id}/trigger` | `{scenario: "LATENCY" 또는 "ERROR_SPIKE"}`, incident 반환 |
| POST `/api/demo/projects/{id}/recover` | 합성 장애 복구 |
| POST `/api/demo/projects/{id}/agent-token` | 런처 전용 토큰 회전 `{agentId,token}`, 기존 Agent ID와 시계열 유지, 응답 캐시 금지 |
| GET `/api/incidents/{id}/preview` | `{message,externalDelivery:false}` |

Incident 응답의 insight는 `source`, `serverName`, `baselineResponseMs`, `currentResponseMs`, `timeoutCount`, `errorCount`, `severity`, `summary`, `evidence`, `causes`, `actions`를 갖는다. 기존 필드는 유지한다. OpenAI 오류/시간초과 시 로컬 근거 기반 설명으로 복구한다. 외부로 보내는 내용은 이 규격에 맞춘 최소 근거이며 원본 로그/토큰은 보내지 않는다.

`demo-fixtures/scenario.json`의 WALLPAD-DEMO, wallpad-demo-01과 수치가 두 실행 모드의 기준이다. 기본 응답 120ms, 지연 시나리오 3200ms/Timeout8/오류3, 오류 급증 450ms/Timeout2/오류24를 사용한다. 실제 장애나 운영 시스템 변경은 발생시키지 않는다.

전체 스택의 C# 수집기는 별도 Agent를 추가하지 않고 토큰 회전 API로 같은 wallpad-demo-01에 실제 합성 수집값을 전송한다. 토큰은 런처 메모리와 자식 프로세스 환경으로만 전달한다. 기본 C# 실행에서는 backend 합성 heartbeat를 끄고, `-SkipAgent` 복구 경로에서는 backend heartbeat로 동일 시드 Agent를 유지한다.

## 담당 경계

- backend-analysis: backend/service, 규칙 분석, LLM, incident, seed와 API.
- web-app: frontend feature/service/types, 실제 브라우저 분석 및 동일 시연 흐름.
- runtime-manager: demo 실행/중지/초기화, 포트/PID 관리, C# 합성 수집기.
- MAIN: 공통 fixture, 디자인 공통 파일, 자료 검토, 문서 및 통합.
- session-monitor: 통합 후 독립 검증. 실행하지 못한 조건은 UNVERIFIED이며 최종 PASS를 만들지 않는다.

Naver Works, SMS, Redmine, Syslog, MQTT, Kafka, Linux Agent, Prediction, SSO, GIS는 이번 구현 범위 밖이며 발표자료 Phase 3~5 로드맵으로 남긴다.
