# Monitoring Platform

프로젝트의 소스와 운영 로그를 한곳에 모아 분석하고, 시스템 상태를 통합 모니터링하는 플랫폼.

```
React (Next.js)  →  Spring Boot API  →  Python 분석 서비스
    frontend            backend              service
                          ↑
          서버 에이전트 (C#) ─ 로그·자원 수집
                agent
```

호출 방향은 항상 위 순서다. **프런트엔드와 에이전트는 Python 서비스를 직접 호출하지 않는다.**
Spring Boot 가 전체 오케스트레이터 역할을 한다.

## 해커톤 원클릭 실행

Windows에서 Node.js, JDK 17, .NET 8 SDK를 준비하고 OUT 루트에서 실행한다. Python 3.11과 프로젝트 의존성은 준비 단계에서 설치한다.

```powershell
.\demo.ps1 -Action Prepare    # 온라인 사전 준비와 production build
.\demo.ps1 -Offline           # 전체 스택과 합성 Agent 실행
.\demo-stop.ps1              # 이 작업에서 기동한 프로세스만 중지
.\demo-reset.ps1             # 시연 DB/업로드 초기화, 빌드는 유지
```

로그인: `http://localhost:3200/login`, `admin@xisnd.com` / `test1234`. 처음부터 `demo.ps1`만 실행하면 준비 후 시작한다. `-Mode Frontend -Offline`은 백엔드 없는 백업이다. 기본 포트가 사용 중이면 `-FrontendPort 13200 -BackendPort 18080 -ServicePort 18000`을 Prepare/Start 양쪽에 지정한다.

OpenAI 키는 실행 환경에만 `$env:OPENAI_API_KEY = '<로컬 키>'`로 설정한다. 키가 없거나 연결이 실패하면 규칙 추출과 incident 설명을 로컬에서 생성한다. 실제 키를 파일이나 Git에 넣지 않는다. [5분 대본·클릭 순서·복구 방법](DEMO.md), [추가 API](backend/DEMO-API.md), [구현 기준](docs/IMPLEMENTATION.md), [독립 검증 결과와 미검증 항목](docs/VERIFICATION.md)을 참고한다.

---

## 구성

| 디렉터리 | 스택 | 포트 | 역할 |
| --- | --- | --- | --- |
| `frontend` | Next.js 14 (App Router) · TypeScript · Tailwind | 3200 | 화면 전체 |
| `backend` | Java 17 · Spring Boot 3.3 · Gradle · JPA · JWT | 8080 | 인증·프로젝트·파일·분석 오케스트레이션 |
| `service` | Python 3.11+ · FastAPI | 8000 | 소스/로그 분석, 추세 이상 탐지 |
| `agent` | C# · .NET 8 · WPF · Windows 서비스 | - | 서버 로그 tail, CPU·메모리·디스크·네트워크 수집 |

---

## 실행

세 개를 각각 띄운다. **프런트엔드만 단독으로 실행해도 화면 전체를 확인할 수 있다**
(백엔드 주소가 없으면 브라우저 내 목 데이터로 동작한다).

### 1. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3200
```

백엔드에 붙이려면 `.env.local` 을 만든다.

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

이 값이 비어 있으면 목 모드로 동작하며, 로그인 화면에 데모 계정
(`admin@xisnd.com` / `test1234`)이 안내된다.

### 2. Backend

```bash
cd backend
cp src/main/resources/application-local.example.yml src/main/resources/application-local.yml
./gradlew bootRun          # http://localhost:8080 (기본 local 프로파일 = H2)
```

MySQL 로 전환:

```bash
DB_HOST=localhost DB_NAME=monitoring DB_USERNAME=... DB_PASSWORD=... \
  ./gradlew bootRun --args='--spring.profiles.active=mysql'
```

분석 서비스는 기본으로 `http://localhost:8000` 을 호출한다. 다른 포트를 쓰면:

```bash
APP_ANALYSIS_BASE_URL=http://localhost:9016 ./gradlew bootRun
```

분석 서비스 없이 띄우려면 `APP_ANALYSIS_ENABLED=false` (분석 요청은 바로 실패로 기록된다).

### 3. Agent (선택)

```powershell
cd agent
powershell -ExecutionPolicy Bypass -File installer/pack-agent.ps1   # dist\MonitoringAgentSetup.exe
```

자세한 내용은 [agent/README.md](agent/README.md).

### 4. Analysis Service

```bash
cd service
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
uvicorn app.main:app --reload --port 8000                 # service 폴더에서 실행 (app 폴더 안 X)
```

---

## 화면 흐름

```
/login  →  /projects  →  /projects/new (5단계 마법사)  →  /projects/{id}  →  /projects/{id}/analysis
                                                      └→ /projects/{id}/agents (토큰 발급) → /projects/{id}/logs (실시간 로그)
/monitoring (이상 탐지, 서버 자원)   /settings/alerts (Slack 채널·알림 규칙)
```

프로젝트가 하나도 없으면 `/projects` 는 빈 상태 화면을 보여주고, 프로젝트를 자동으로 열지 않는다.

---

## 구현 범위

구현됨:

- 로그인 / 회원가입 (JWT), 토큰 만료 시 자동 로그아웃, 내 정보·비밀번호 변경
- 첫 프로젝트 온보딩(전체 화면) · 프로젝트 목록 · 검색
- 프로젝트 생성 마법사 (기본정보 → 기술스택 → 규칙 문서 → 소스 ZIP → 확인)
- 프로젝트 상세 (개요 / 분석 / 로그 / 프로젝트 파일 / 설정)
- 파일 업로드 (규칙 문서, 소스 ZIP, 로그) · 확장자·용량 검증
- 소스 정적 분석 (Python): 언어·규모 통계, 코드 품질·오류 위험·보안·성능 규칙,
  규칙 문서에서 금지 항목과 길이 기준을 읽어 반영, 로그 오류 패턴 집계, 품질 점수
- 분석은 백엔드가 비동기로 실행하고 결과(JSON)를 저장, 화면은 완료될 때까지 자동 갱신
- 개요 · 모니터링(서비스 상태, 품질 추이) · 분석 이력 · 이벤트(활동 기록) · 설정 화면
- 수집 에이전트 (C#): 프로젝트별 토큰 발급, Windows 서비스 설치, 로그 tail·서버 자원 수집, 끊겼을 때 보관 후 재전송, 트레이 상태 카드
- 실시간 수집 로그 화면, 서버별 CPU·메모리·디스크 추이 차트
- 이상 탐지: 연결 끊김, CPU·메모리·디스크 임계치, 오류 로그 급증, 치명 로그, 처음 보는 오류, 평소 추세 대비 급증(Python)
- Slack 알림: 채널·규칙(대상 프로젝트, 심각도, 유형, 해결 알림, 조용한 시간), 테스트 발송, 발송 기록, 중복 억제
- MD/PDF/XLSX/DOCX 본문·표 추출, 규칙 인용과 코드 위치 연결, 금지·길이·이름 검사
- OpenAI 규칙 추출·사건 설명과 로컬 폴백, 안전 장애 트리거·복구, 동일한 브라우저 단독 시연
- ONLINE 합성 Agent 시계열·로그, 사건과 일치하는 대시보드 집계 및 Slack 미리보기

아직 구현하지 않음 (다음 단계):

- Naver Works / SMS / Redmine 알림 채널
- Syslog / MQTT / Kafka 입력, Linux 에이전트
- 예측(Prediction), SSO, GIS

---

## 다음 단계 진입점

| 하려는 일 | 손댈 곳 |
| --- | --- |
| 실제 분석 로직 | `service/app/analysis/engine.py` |
| 소스 ZIP 해석 | `service/app/parser/source_archive.py` |
| 좌측 메뉴 추가 | `frontend/src/widgets/layout/nav.ts` |
| 프로젝트 상세 탭 추가 | `frontend/src/widgets/layout/nav.ts` 의 `PROJECT_TABS` |
| 청크 업로드 전환 | `frontend/src/services/fileApi.ts` + `backend/.../file/FileStorageService.java` |
| 저장소를 S3 로 교체 | `backend/.../file/FileStorageService.java` |
| 이상 탐지 규칙·기준값 | `backend/.../incident/IncidentDetector.java`, `app.detection.*` |
| 알림 채널 추가 | `backend/.../alert/AlertDispatcher.java` (Slack 은 `SlackNotifier`) |
| LLM 설명·로컬 폴백 | `backend/.../alert/IncidentInsight.java`, `backend/.../llm/` |
| 에이전트 수집 로직 | `agent/src/MonitoringAgent.Worker/Services/CollectorScheduler.cs` |
