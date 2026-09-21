# Backend — Monitoring Platform API

Java 17 · Spring Boot 3.3 · Gradle · Spring Security(JWT) · Spring Data JPA

화면(React)과 분석 서비스(Python) 사이의 오케스트레이터.
프런트는 이 API 만 호출하고, Python 호출은 전부 여기를 거친다.

## 실행

PowerShell에서 직접 실행할 때 먼저 프로젝트 전용 Codex 로그인을 완료하고 실제 사용 가능한 모델을 명시한다.
`application-local.yml`은 배포 JAR에 포함되지 않으므로 외부 설정 위치를 직접 지정해야 한다.

```powershell
# backend 디렉터리에서 실행. 이미 작성한 local 설정이 있으면 복사를 생략한다.
Copy-Item src/main/resources/application-local.example.yml src/main/resources/application-local.yml
$env:SPRING_CONFIG_ADDITIONAL_LOCATION='file:./src/main/resources/application-local.yml'
$env:APP_RUNTIME='local'
$env:LLM_PROVIDER='codex_oauth'
$env:CODEX_MODEL='<사용 권한이 있는 모델 이름>'
$env:CODEX_AUTH_FILE='<저장소와 기본 .codex 밖의 프로젝트 전용 auth.json 절대 경로>'
$env:APP_JWT_SECRET='<32바이트 이상의 로컬 JWT 비밀값>'
./gradlew.bat bootRun
./gradlew.bat test     # 테스트 자식 프로세스는 test/mock으로 고정, 실모델 호출 없음
./gradlew.bat build
```

복사한 local 예제는 `127.0.0.1`에만 바인딩하며 H2 파일 DB(`./data/local`)를 사용한다.
통합 데모의 로그인·시작·종료는 루트 README의 `llm.ps1`, `demo.ps1`을 따른다.

MySQL 배포는 local 외부 설정 변수를 제거한 별도 실행 환경에서 다음 값을 명시한다:

```bash
APP_RUNTIME=deployed LLM_PROVIDER=openai_api OPENAI_MODEL='<explicit-model>' OPENAI_API_KEY='<deployment-key>' \
DB_HOST=localhost DB_PORT=3306 DB_NAME=monitoring DB_USERNAME=... DB_PASSWORD=... \
  ./gradlew bootRun --args='--spring.profiles.active=mysql'
```

실제 비밀값을 명령 기록이나 저장소에 남기지 말고 배포 환경의 비밀변수로 주입한다.
`APP_RUNTIME`과 `LLM_PROVIDER`는 대문자 프로세스 환경변수가 권위이며 Spring 설정으로 덮어쓸 수 없다.
선택 조합은 `local/codex_oauth`, `deployed/openai_api`, 테스트 전용 `test/mock`뿐이다.
local은 API 키를 조회하지 않고, deployed는 OAuth 파일 경로를 조회하거나 파일을 읽지 않는다.
인증 실패 시 다른 공급자로 재시도하지 않으며 제품 기능은 고정 경고와 함께 비 AI LOCAL 템플릿으로 대체한다.

`./gradlew.bat -q llmDiagnose`는 모델 네트워크 요청 없이 설정을 확인한다.
`./gradlew.bat -q llmSmoke`는 선택한 공급자에 최소 구조화 요청을 1회 실행한다.
성공 출력은 `runtime`, `provider`, `model`, `authConfigured` 네 필드만 포함하고, 실패는 안전한 `code`와 `message`를 추가한다.
실패 종료 코드 구분은 루트 `llm.ps1`을 사용한다. `LLM_TIMEOUT_SECONDS`는 기본 4초이며 1~60초로 명시 가능하다.

## 환경변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `APP_JWT_SECRET` | 로컬 전용 값 | **운영에서는 반드시 지정** (32바이트 이상) |
| `APP_STORAGE_LOCATION` | `./storage` | 업로드 파일 저장 위치 |
| `APP_ANALYSIS_ENABLED` | `true` | false 면 분석 요청을 바로 실패로 기록 |
| `APP_ANALYSIS_BASE_URL` | `http://localhost:8000` | 분석 서비스 주소 |
| `APP_ANALYSIS_TIMEOUT` | `600` | 분석 응답 대기 시간(초) |
| `APP_LOG_RETENTION_DAYS` | `14` | 수집 로그 보관 일수 |
| `APP_METRIC_RETENTION_DAYS` | `30` | 서버 지표 보관 일수 |
| `APP_DETECTION_ENABLED` | `true` | 이상 탐지(1분 주기) 사용 여부 |
| `APP_PUBLIC_URL` | 없음 | 알림 메시지의 "플랫폼에서 보기" 링크 주소 |
| `APP_RUNTIME` / `LLM_PROVIDER` | 없음 | 위의 명시적 실행 환경·공급자 조합 필수 |
| `CODEX_MODEL` / `CODEX_AUTH_FILE` | 없음 | local 전용 모델 및 프로젝트 전용 외부 인증 파일 |
| `OPENAI_MODEL` / `OPENAI_API_KEY` | 없음 | deployed 전용 모델 및 API 키 |
| `LLM_TIMEOUT_SECONDS` | `4` | 응답 본문을 포함한 요청 제한 시간, 1~60초 |

이상 탐지 기준값은 `app.detection.*` (cpu-warn 90, disk-warn 90, error-burst 20 등, `DetectionProperties`),
Slack 주소 허용 목록은 `app.alerts.slack-allowed-prefixes`, 에이전트 설치 파일 경로는 `app.agent.installer-path`.

CORS 허용 출처는 `app.cors.allowed-origins` (기본 `http://localhost:3200`).

## 패키지

```
com.xisnd.monitoring
├─ common     예외/공통 응답/BaseTimeEntity/health
├─ security   JWT 생성·검증 필터, CurrentUser
├─ config     Security · CORS · 저장소 · 분석서비스 설정
├─ user       User, Role, UserRepository
├─ auth       회원가입 / 로그인 / me
├─ project    Project, ProjectTechnology, 코드 중복 확인
├─ file       업로드 저장(확장자·경로 검증), 목록/삭제
├─ analysis   분석 실행, 이력, Python 서비스 클라이언트
├─ agent      에이전트 등록·토큰(해시 저장)·설치 파일
├─ ingest     에이전트 수집 API (X-Agent-Token, gzip, 요청 크기·횟수 제한)
├─ telemetry  log_entry · metric_point 저장·조회, 보관 기간 정리
├─ incident   이상 탐지(규칙 + Python 추세), 열림/해결 기록
└─ alert      Slack 채널·알림 규칙·발송 기록, LLM 요약 연결 지점
```

## API

```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me

GET    /api/projects
POST   /api/projects
GET    /api/projects/{projectId}
PUT    /api/projects/{projectId}
DELETE /api/projects/{projectId}
GET    /api/projects/check-code?code=...

GET    /api/projects/{projectId}/files
POST   /api/projects/{projectId}/files          (multipart: file, fileType)
DELETE /api/projects/{projectId}/files/{fileId}

PUT    /api/auth/me                              내 정보 수정
PUT    /api/auth/password                        비밀번호 변경

POST   /api/projects/{projectId}/analysis        비동기 실행(202), 결과는 latest 로 확인
GET    /api/projects/{projectId}/analysis/latest (result 포함)
GET    /api/projects/{projectId}/analysis/history

GET    /api/dashboard                            개요 집계
GET    /api/analyses?limit=100                   전체 분석 이력
GET    /api/events?projectId=&level=&page=&size= 활동 이벤트
GET    /api/system/status                        API·DB·분석 서비스 상태

GET    /api/projects/{projectId}/agents          에이전트 목록(상태·최근 지표)
POST   /api/projects/{projectId}/agents          등록 (토큰 원문은 이 응답에서만)
DELETE /api/projects/{projectId}/agents/{agentId}
GET    /api/agent-installer                      설치 파일 정보
GET    /api/agent-installer/download

POST   /api/ingest/heartbeat                     에이전트 전용 (X-Agent-Token)
POST   /api/ingest/logs                          최대 1000건, gzip 가능
POST   /api/ingest/metrics                       최대 500건

GET    /api/projects/{projectId}/log-entries?agentId=&level=WARN&q=&afterId=&limit=
GET    /api/projects/{projectId}/metrics?agentId=&minutes=60
GET    /api/monitoring/overview

GET    /api/incidents?projectId=&status=OPEN&limit=
POST   /api/incidents/{incidentId}/resolve

GET    /api/alerts/channels | POST | PUT /{id} | DELETE /{id} | POST /{id}/test
GET    /api/alerts/rules    | POST | PUT /{id} | DELETE /{id}
GET    /api/alerts/deliveries?limit=30

GET    /api/health
```

인증이 필요 없는 경로: `/api/auth/signup`, `/api/auth/login`, `/api/health`.
`/api/ingest/**` 는 JWT 대신 에이전트 토큰(`X-Agent-Token`)으로 인증한다.
그 외는 `Authorization: Bearer <token>` 이 필요하다.

오류 응답 형태는 항상 아래와 같다 — 프런트는 `message` 만 읽는다.

```json
{ "status": 409, "message": "이미 사용 중인 프로젝트 코드입니다.", "timestamp": "..." }
```

## 알아둘 것

- 프로젝트는 **생성자 본인만** 조회·수정할 수 있다. 타인의 프로젝트는 404 로 응답한다(존재 여부 비노출).
- 프로젝트 코드는 생성 후 변경하지 않는다(파일 경로·분석 이력이 코드에 묶여 있다).
- 프로젝트 삭제 시 DB 뿐 아니라 저장소의 실제 파일도 함께 지운다.
- `ddl-auto: update` 는 개발 단계 설정이다. 운영 전환 시 `validate` + 마이그레이션 도구로 바꾼다.
- enum 값은 varchar 로 저장한다. 예전 스키마의 enum 컬럼은 시작할 때 `EnumColumnMigration` 이 varchar 로 바꾼다.
- 이상은 같은 대상이 열려 있는 동안 한 건으로 묶이고, 같은 이상의 발생 알림은 채널별로 10분 안에 다시 보내지 않는다.
