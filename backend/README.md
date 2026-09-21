# Backend — Monitoring Platform API

Java 17 · Spring Boot 3.3 · Gradle · Spring Security(JWT) · Spring Data JPA

화면(React)과 분석 서비스(Python) 사이의 오케스트레이터.
프런트는 이 API 만 호출하고, Python 호출은 전부 여기를 거친다.

## 실행

```bash
./gradlew bootRun     # 기본 local 프로파일 = H2 파일 DB(./data), 설치 없이 바로 기동
./gradlew test
./gradlew build
```

MySQL 로 전환:

```bash
DB_HOST=localhost DB_PORT=3306 DB_NAME=monitoring DB_USERNAME=... DB_PASSWORD=... \
  ./gradlew bootRun --args='--spring.profiles.active=mysql'
```

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
