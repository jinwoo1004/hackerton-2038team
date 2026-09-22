# 프런트엔드 전용 시연 독립 검증 — 2026-09-22

배포 전 프런트엔드 전용 시연의 **코드·자동 테스트·프로덕션 빌드·로컬 기능 시연은 PASS**다. 최종 빌드와 MAIN이 수행한 브라우저의 화면·DOM·집계 증거를 독립 검증자가 읽고 확인했다. 실제 브라우저 네트워크 trace는 확보하지 못해 그 항목은 **UNVERIFIED**다. 전체 스택과 실제 공개 배포의 성공을 판정하지 않는다.

독립 검증자는 제품 파일, 실행 중인 앱, 브라우저 상태를 변경하지 않았다. 사용자 `agent/dist/MonitoringAgentSetup.zip`은 미추적 상태로 보존했다. 상위 `AGENTS.md`의 독립 검증 역할과 미실행 항목을 PASS로 표시하지 않는 기준을 적용했다.

| 검증 항목 | 수행 방법 | 실제 결과 | 판정 |
|---|---|---|---|
| 프런트 전체 회귀 | 최종 차트·모바일·잠금 파일 수정 후 독립 재실행 `npm test` | 23개 통과, 실패·건너뜀 0 | PASS |
| 타입 | 최종 수정 후 독립 재실행 `npm run type-check` | `tsc --noEmit` 종료 0 | PASS |
| 실행 모드 | 독립 실행 `pwsh -NoProfile -File scripts/runtime/test-data-mode.ps1` | 6개 계약 통과. Prepare 성공/실패·부모 환경 유무 및 Full/Frontend 선택 검사. 빌드와 실행 작업은 메모리 stub | PASS |
| 기본 mock 및 API 선택 | 설정 코드 검토와 `deployment-config.test.ts` | 변수 미설정/빈 값은 mock, api만 명시적 서버 연결. 모드 오타 실패. mock은 과거 API URL이 남아도 무시. Vercel api는 공개 HTTPS 원점 필요 | PASS |
| 백엔드 호출 차단 | API facade 회귀에서 fetch를 실패 함수로 교체 | 로그인·프로젝트·대시보드·모니터링·트리거·미리보기·복구의 fetch 0회. HTTP, XHR 업로드, 설치기 직접 호출도 mock에서 거부 | PASS |
| 최초 데이터 | 결정적 생성과 수치 비교 | 7개 프로젝트, 210개 분석 이력(프로젝트별 30개), 11개 합성 Agent. 건강 집계: 정상 4/주의 2/심각 1, 열린 이상 3 | PASS |
| 분석 근거 | 실제 로컬 분석기로 합성 입력 분석, 최신/과거 상세 재구성 | 분석 점수와 상세 일치, 규칙 출처·소스 파일·행 번호 존재. 원본 규격이나 실제 운영 품질로 표현하지 않음 | PASS |
| 시계열 | 60/360/1440분 및 장기간 경과 회귀 | CPU/메모리/디스크/응답시간 변동 및 프로젝트별 차이 확인. 45일 경과 후 Agent heartbeat·최근 합성 로그 갱신, 프로젝트별 분석 30개 유지 | PASS |
| 저장·이전·분리 | 메모리 localStorage를 이용한 API 회귀 | 기존 `mp.mockdb` 원본 보존 후 versioned key 생성. 반복 조회 중복 없음, 프로젝트 삭제 유지, 신규 계정별 갤러리 분리 및 타인 프로젝트 접근 거부 | PASS |
| 초기화 | 반복 reset, 기존 사용자 프로젝트 및 다른 계정 보존 회귀 | 시연 갤러리 복원, 프로젝트 코드 중복 없음. 기존 프로젝트와 다른 계정의 프로젝트 유지 | PASS |
| 장애 흐름 | 트리거·재트리거·미리보기·복구 회귀 | 반복 LATENCY 트리거는 동일 incident, 건강 집계 증가 후 복구 시 원상복귀, 응답 3200ms와 Slack 미리보기 일치, 외부 발송 false | PASS |
| 사용자 안내 | 루트/프런트 README, DEMO, DEPLOYMENT 검토 | 기본 mock·명시 api·합성 데이터·브라우저 저장 범위 일치. 발견한 루트 README의 이전 URL 기반 설명은 MAIN 수정 후 재검토 | PASS |
| 배포 로그 제외 규칙 | 독립 `ignore` 라이브러리로 실제 `.vercelignore` 12개 경로 검사 | `demo-fixtures`의 작성된 합성 로그 2개만 예외. 일반 운영 로그, 다른 경로의 같은 파일명, 자격 파일, build/node_modules는 제외 | PASS: 패턴 검사 |
| 잠금 파일 복구 | 독립 JSON 비교 + web_app 설치 로그 검토 | 기존 의존성 version/range 변경 0, 누락된 `@emnapi/core`, `@emnapi/runtime` 2개 추가. npm 10 원본 EUSAGE 재현 후 수정 dry-run 및 실제 398개 설치 종료 0 | PASS: 수정·소유자 설치 근거 |
| 차트 평균 집계 | 독립 코드 검토 | agent별로 bucketSeconds 시간 구간의 최신 샘플 1개를 선택한 뒤 평균. agent 간 밀리초 차이로 같은 구간이 여러 점이 되는 문제 방지 | PASS: 코드 검토 |
| 프로덕션 빌드 | MAIN 실행 종료 0 및 독립 BUILD_ID 확인 | `VERCEL=1`, `NEXT_PUBLIC_DATA_MODE=mock`, 과거 API URL이 남은 조건. 최종 ID `3yEk3p65LJFxTqhbKrKZB` | PASS |
| 1440×900 실제 브라우저 | MAIN 조작, 독립 screenshot/DOM/JSON 검토 | 데모 로그인→대시보드→모니터링→트리거/미리보기/복구→프로젝트 분석→새로고침. 콘솔 warning/error 0 | PASS: 로컬 기능 시연 |
| 모바일 | MAIN 최종 390px override, 독립 증거 검토 | 문서 `clientWidth=382`, `scrollWidth=382`, 가로 넘침 없음. `mobile-final.png` 검토 | PASS |
| 실제 브라우저 네트워크 캡처 | MAIN 증거의 제한 확인 | network trace 미확보. API facade의 fetch 0회 회귀는 실제 브라우저 캡처를 대체하지 않음 | UNVERIFIED |

첫 갤러리 생성은 최종 독립 Node 테스트에서 107ms, 저장 데이터는 505,564자(UTF-16 환산 약 0.96MiB)였다. 이것은 해당 테스트 환경의 측정값이며 브라우저 체감 성능이나 저장 한도 보장은 아니다. 과거 분석 전체 결과를 중복 저장하지 않고 합성 입력으로 상세 결과를 재구성한다.

잠금 파일 설치 근거는 `.work/npm-lock-repair-20260922`의 소유자 로그다. npm 10.9.4의 Linux-targeted 설치 검증으로 기록하며 실제 Linux 호스트의 프로덕션 빌드로 확대 해석하지 않는다. optional dependency 다운로드의 일부 연결 재설정과 npm 12/Node 조합의 엔진 경고가 있었고, npm 12 dry-run 통과를 지원 Node 조합 확인으로 취급하지 않는다. 독립 검증자는 실행 중 앱의 의존성을 교체하지 않았다.

실제 로컬 브라우저에서 7개 프로젝트·210개 분석·21개 파일·11개 Agent를 확인했다. 데스크톱에서 24시간 지표 기간, CPU/메모리/디스크 및 7개 응답시간 시계열을 탐색했다. LATENCY 트리거의 화면 측정값은 **0.15초**였고 열린 이상 수가 **3→4→복구 후 3**으로 일치했다. Slack에는 외부 발송이 아닌 미리보기라고 표시되고 3200ms·Timeout 8건·오류 3건이 설명과 일치했다. 개포 분석 상세는 85점과 규칙 근거를 표시했고, 30개 이력 및 새로고침 후 상태 유지도 확인했다. 이는 합성 시연이며 실제 장애·실제 AI 생성 품질을 측정한 결과가 아니다.

브라우저 실행 증거는 로컬 비추적 경로 `.work/showcase-review/verification.json`, `overview.png`, `projects.png`, `trigger-dom.txt`, `analysis-dom.txt`, `mobile-final.png`, `metric-trends-final.png`다. 독립 검증자는 이 파일들을 읽었으며 브라우저를 직접 조작하지 않았다. `mobile.png`와 `mobile-fixed.png`, `metric-trends.png`는 수정 전 또는 중간 결과이므로 최종 모바일/집계 판정 근거로 사용하지 않았다.

코드 검토에서 서버 호출 지점은 공통 HTTP/XHR, 설치기 다운로드, 로컬 `/demo/` 정적 fixture 읽기로 한정됐다. 전자의 서버 경로에는 mock guard가 있으며, `/demo/`는 같은 프런트엔드의 합성 정적 파일이다. 기존 파일 처리 기능은 실제 사용자가 선택한 파일을 브라우저 안에서 분석한다. 배포 asset 복사는 저장소의 합성 `demo-fixtures`를 대상으로 하며 사용자의 첨부 원본 ZIP·운영 로그·보호 문서를 복사하는 변경은 없다.

mock UI에는 `시연 데이터 · DEMO`, `시연용 AI 설명 · 합성 데이터`를 표시한다. 시연용 로그인과 저장소는 브라우저 데모 기능이며 실제 서버 인증으로 취급하지 않는다. 알림과 AI 설명도 합성 시연이며 이번 검증에서 외부 Slack 발송·모델 호출은 0회였다.

`demo.ps1`은 Full 빌드/실행에 `api`, Frontend에 `mock`을 명시한다. 새 실행 모드 테스트는 실제 Prepare 함수와 런타임 할당을 검사하지만 현재 스택을 다시 시작하는 lifecycle 실증은 아니다. 이전 전체 스택·.NET·FastAPI 검증 기록은 과거 범위로 유지하고 이번 프런트 변경 때문에 반복하지 않았다.

보고서 작성 시점의 실제 Vercel 배포·외부 주소·전체 스택·실제 Agent/모델 연결은 이번 범위에서 **UNVERIFIED / 범위 밖**이다. Vercel 환경변수 저장 UI 오류가 있어 실제 저장 성공을 주장하지 않는다. 코드 기본값 mock의 로컬 빌드는 통과했으나 외부 배포 확인은 이후 별도 작업이다. 문서의 Vercel 구성 안내는 준비 방법이며 공개 배포 성공 증거가 아니다.
