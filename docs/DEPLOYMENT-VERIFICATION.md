# 배포 준비 독립 검증 — 2026-09-21

소스·설정 준비 검증은 **PASS**다. 실제 공개 배포 상태는 **BLOCKED / MISSING_ACCESS_AND_SERVER**다. 요청한 Vercel 워크스페이스 접근 권한과 서버 제공 정보가 아직 확인되지 않았으므로 공개 URL, 클라우드 화면, 운영 가동 성공을 검증한 기록이 아니다.

검증 담당자는 제품 소스를 수정하지 않았고, 실제 모델 호출·설치기 실행·앱 재시작을 하지 않았다. 상세한 기계 판독 결과는 [deployment-readiness.json](evidence/deployment-readiness.json)에 있다.

| 범위 | 수행자와 방법 | 실제 결과 | 판정 |
|---|---|---|---|
| Backend | 독립 검증: Gradle `test bootJar`, `test/mock`, 별도 buildDir | 72개 전체 통과, JAR 생성. 배포 설정 5개·분석 인증 3개·H2 보안 분기 3개 포함 | PASS |
| FastAPI | 독립 검증: `pytest -q tests` | 23개 통과. 배포 인증·읽기 전용 파일 분석·경로 이탈 방지 포함 | PASS |
| Frontend | 독립 검증: `npm test`, `npm run type-check` | 13개 통과, 타입 오류 없음 | PASS |
| Vercel용 프로덕션 빌드 | MAIN 실행 완료 기록 + 독립 산출물 확인 | `VERCEL=1`, `NEXT_PUBLIC_API_BASE_URL=https://api.example.com`, `.next-vercel-check` 빌드 ID 존재. 브라우저 번들에도 해당 API 원점 반영 | PASS: 로컬 빌드 범위 |
| Compose 명세 | runtime_manager가 공식 Draft2020-12 스키마로 base/TLS/merged 3종 검사; 독립 검증에서 동결 파일 SHA256 일치 확인 | 소유자 기록 `deploy/verification.json`과 일치 | PASS: 소유자 실행 근거 |
| 배포 설정 계약 | 독립 YAML·Dockerfile·애플리케이션 설정 검토 및 자동 assertion | 분석 서비스·MySQL은 내부 네트워크만 사용하고 호스트 포트 없음. Backend는 loopback 8080, TLS 옵션은 Caddy 80/443 | PASS: 정적 검증 |
| 저장소와 권한 | 독립 설정 검토 | Backend/analysis UID 10001, 공유 스토리지 rw/ro, MySQL 별도 볼륨, 단일 replica 설정 | PASS: 설정 / 실제 볼륨 권한은 UNVERIFIED |
| 실행 전 설정 실패 | 독립 `bash -n` 및 외부 env 파일 guard 3개 | 누락·상대경로·Git 체크아웃 내부 파일을 Docker 호출 전에 거부. Compose 필수 변수는 `:?`로 선언 | PASS: Docker 이전 범위 |
| 인증·비밀 경계 | 독립 소스·브라우저 번들·JAR 리소스 이름/패턴 검사 | 실제 자격 증명 패턴 0건, private auth/local 설정이 JAR에 없음, COPY allowlist와 ignore 규칙 확인 | PASS: 정적 범위 |
| 기존 환경 보존 | 독립 시작/종료 snapshot 비교 | 6개 포트의 PID 동일, 실행 JAR SHA256 동일, 운영 DB 존재 유지, 사용자 Agent ZIP 바이트·SHA256 동일하며 Git 미추적 유지 | PASS |

비밀값은 이미지·소스·브라우저 번들에 포함하지 않는 구조다. 실행 시에는 Backend에 API/JWT/DB/분석 인증 비밀, FastAPI에 분석 인증 비밀, MySQL에 DB 비밀번호가 필요하며 외부 환경 파일에서 해당 컨테이너로 전달한다. 컨테이너의 실행 환경에 비밀이 전혀 없다는 의미가 아니다. Docker 이미지 자체는 만들지 않았으므로 실제 이미지의 비밀 검사 역시 UNVERIFIED다. 패턴 검사는 고신뢰 API 키·JWT·개인키 형태와 리소스 이름을 확인한 것으로 모든 종류의 비밀 부재를 증명하지는 않는다.

`APP_RUNTIME=deployed` / `LLM_PROVIDER=openai_api`와 필수 설정을 명시하고 OAuth 환경은 Compose에 전달하지 않는다. Backend→FastAPI는 `X-Analysis-Token`을 사용하며 리다이렉트에 비밀이 전달되지 않도록 제한한다. FastAPI의 `/health` 이외 경로는 배포 인증 대상이고 배포 시 자동 API 문서도 비활성화된다. Backend의 배포 H2 콘솔은 익명 401/인증 사용자 403, local/test는 기존 허용 동작이며 실제 보안 필터 체인 테스트로 확인했다.

기본 서버 이미지에는 Windows Agent 설치기를 넣지 않는다. 설치기 정보의 `available=false` / 다운로드 404가 기본 계약이며 제공하려면 검증된 EXE를 외부 읽기 전용 볼륨으로 연결하고 `APP_AGENT_INSTALLER_PATH`를 지정한다. 사용자의 `agent/dist/MonitoringAgentSetup.zip`은 그대로 보존했으며 이번 커밋 대상으로 추가하지 않았다.

## 검증 환경 및 재현

실행 중인 Backend JAR를 바꾸지 않도록 [deployment.init.gradle](../scripts/verification/deployment.init.gradle)이 출력 폴더를 `.work/deployment-verification/backend-build`로 분리한다. 테스트 데이터는 테스트용 메모리 DB와 테스트 스토리지를 사용한다. 기존 앱의 DB는 정상 Agent 입력으로 계속 바뀔 수 있어 바이트 해시를 비교하지 않았다.

PowerShell에서 Java 17과 Gradle 캐시 경로를 설정한 후 다음과 같이 검증했다. 자격 증명과 운영 설정 환경변수는 값 출력 없이 `Remove-Item Env:NAME`으로 테스트 프로세스에서 제거했다. 예: `OPENAI_API_KEY`, `CODEX_AUTH_FILE`, `CODEX_HOME`, `APP_JWT_SECRET`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `APP_ANALYSIS_SHARED_SECRET`.

```powershell
$env:APP_RUNTIME = 'test'
$env:LLM_PROVIDER = 'mock'
# backend 디렉터리
.\gradlew.bat --no-daemon --offline --console=plain --init-script ../scripts/verification/deployment.init.gradle test bootJar
# service 디렉터리
..\.tools\python311\python.exe -m pytest -q tests --junitxml=../.work/deployment-verification/service-tests.xml
# frontend 디렉터리
npm.cmd test
npm.cmd run type-check
```

[deployment-readiness.py](../scripts/verification/deployment-readiness.py)는 위 XML 결과, 프런트 실행 결과 JSON, 시작/종료 보존 snapshot을 집계하고 정적 검사를 실행한다. 입력은 `.work/deployment-verification`에 있으며 산출물에는 비밀값·운영 로그 본문을 저장하지 않았다. Python의 PyYAML과 Git Bash가 필요하다. 공식 Compose 스키마 검사는 독립 재실행하지 않았으므로 소유자 수행 근거와 구분했다.

최초 검증 명령은 PowerShell 환경변수를 빈 값으로 남겨 JWT 설정을 덮어썼고 72개 중 13개가 실패했다. 검증 명령의 제거 방식을 수정한 후 전체 72개가 통과했다. 제품 코드 수정은 없었다. Python 실행에는 기존 anyio deprecation 경고 1건이 있었으며 테스트 실패는 없었다.

## 남은 실제 배포 검증

Docker CLI가 없어 이미지 빌드, 실제 `docker compose config/up`, 컨테이너 health, MySQL 초기화·재시작 후 데이터 보존, 공유 볼륨 실제 UID, 백업·복구는 **UNVERIFIED**다. 요청한 Vercel 워크스페이스 접근과 서버·도메인 확보 후 DNS/TLS, CORS, 브라우저 로그인·업로드·분석·Agent 수집을 실제 주소에서 확인해야 한다. 배포용 OpenAI API의 실제 과금 호출도 이번 검증에서 수행하지 않았다. 기존 LOCAL/OAuth 데모 앱은 그대로 유지했다.
