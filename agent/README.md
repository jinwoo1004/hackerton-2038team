# Monitoring Agent

서버에 설치해 로그 파일과 CPU·메모리·디스크·네트워크 사용량을 Monitoring Platform 으로 보내는 Windows 에이전트.

C# · .NET 8 · WPF(설치/트레이 화면) · Worker Service(Windows 서비스)

```
[서버] MonitoringAgentService (Windows 서비스, SYSTEM)
          │  로그 tail · 자원 측정 · heartbeat
          └─ HTTPS + X-Agent-Token ──▶ backend /api/ingest/{heartbeat,logs,metrics}
[로그인 사용자] MonitoringAgentApp --background (트레이 상태 카드)
```

## 구성

| 경로 | 설명 |
| --- | --- |
| `src/MonitoringAgent.Worker` | 수집 서비스 본체. 로그 tail, 지표 측정, 전송, 전송 실패분 보관 후 재전송 |
| `src/MonitoringAgent.App` | 설치 화면, 트레이 상태 카드, 삭제 확인 창. Worker 의 수집 로직을 그대로 쓴다 |
| `tests/MonitoringAgent.Tests` | 로그 파싱·tail·설정·보관 테스트 |
| `installer/pack-agent.ps1` | 단일 설치 파일 `dist/MonitoringAgentSetup.exe` 생성 |
| `installer/make-icon.ps1` | 앱 로고(frontend 의 `logo_mark.png`)로 아이콘 생성 |

## 빌드

```powershell
dotnet build MonitoringAgent.sln
dotnet test tests/MonitoringAgent.Tests/MonitoringAgent.Tests.csproj
powershell -ExecutionPolicy Bypass -File installer/pack-agent.ps1   # dist\MonitoringAgentSetup.exe
```

백엔드는 `app.agent.installer-path`(기본 `../agent/dist/MonitoringAgentSetup.exe`)에 파일이 있으면
프로젝트 > 에이전트 탭에 "설치 파일 받기" 버튼을 보여준다.

## 설치 흐름

1. 플랫폼의 프로젝트 > 에이전트 탭에서 에이전트를 등록하고 토큰을 받는다 (토큰 원문은 한 번만 보인다).
2. 서버에서 `MonitoringAgentSetup.exe` 실행 → 언어 선택 → 서버 주소·토큰 입력 후 연결 확인 → 수집할 로그 경로 선택.
3. "설치하고 시작하기" 를 누르면 UAC 승인 후
   - `%ProgramFiles%\MonitoringAgent` 에 복사
   - `모니터링 에이전트 서비스`(MonitoringAgentService) 를 자동 시작·실패 시 재시작으로 등록
   - 설정은 `%ProgramData%\MonitoringAgent\agent.json` (관리자·SYSTEM 만 읽기)
   - 제어판 "프로그램 및 기능" 에 등록
4. 로그인 사용자는 트레이 아이콘으로 상태(연결, 최근 전송, 보낸 로그 수, 보관 중인 묶음)를 본다.

UAC 를 거부하면 서비스 없이 로그인한 동안 트레이 프로세스가 직접 수집한다.

## 설정 파일

`%ProgramData%\MonitoringAgent\agent.json`

```json
{
  "server": "https://monitoring.example.com",
  "token": "agt_xxxxxxxx",
  "logs": [
    { "path": "C:\\app\\logs\\*.log" },
    { "path": "D:\\iis\\**\\*.log" }
  ],
  "metricsIntervalSeconds": 15,
  "heartbeatIntervalSeconds": 30,
  "logFlushSeconds": 5,
  "logBatchSize": 500,
  "spoolMaxMb": 50
}
```

- 파일을 고치면 서비스가 다음 heartbeat 때 다시 읽는다 (재시작 불필요).
- `path` 는 폴더, 파일, `*` 패턴, `**` (하위 폴더 포함) 을 쓸 수 있다.
- 처음 켜질 때 이미 있던 내용은 보내지 않고 새로 쓰인 줄만 보낸다. 켜진 뒤 새로 생긴 파일은 처음부터 읽는다.
- 로그 한 건은 줄 단위이며, 탭·공백이나 `at `, `Caused by` 로 시작하는 줄은 앞 줄(스택트레이스)에 붙인다.
- JSON 한 줄 로그는 `level`, `message`, `timestamp` 류 필드를 읽는다.
- 서버에 못 보낸 묶음은 `%ProgramData%\MonitoringAgent\spool` 에 보관했다가 다시 연결되면 보낸다 (한도 `spoolMaxMb`).

## 파일 위치

| 경로 | 내용 |
| --- | --- |
| `%ProgramData%\MonitoringAgent\agent.json` | 설정 (토큰 포함) |
| `%ProgramData%\MonitoringAgent\status.json` | 트레이가 읽는 상태 |
| `%ProgramData%\MonitoringAgent\offsets.json` | 파일별로 읽은 위치 |
| `%ProgramData%\MonitoringAgent\logs` | 에이전트 자체 로그 (일 단위) |
| `%ProgramData%\MonitoringAgent\requests` | 트레이의 "지금 보내기" 요청 |

## 개발 중 실행

### 해커톤 합성 시연

루트 `demo.ps1`은 데모 프로젝트의 `wallpad-demo-01` Agent 토큰을 회전해 Worker를 `--demo`로 실행한다.
이 경로는 서비스 설치·실제 시스템 지표 측정·실제 로그 파일 읽기를 하지 않는다.
5초마다 고정 수식으로 CPU/메모리/디스크/네트워크 지표와 `[SYNTHETIC]` 로그를 생성하여
기존 `/api/ingest/heartbeat`, `/api/ingest/metrics`, `/api/ingest/logs`에 전송한다.
시작 시각만 현재 시각에 맞추며, 같은 시작 시각과 순번의 값은 항상 같다.

개별 실행 시 `MONITORING_DEMO_SERVER`에 loopback 주소,
`MONITORING_DEMO_AGENT_TOKEN`에 플랫폼에서 발급한 토큰을 환경변수로 전달한다.
토큰을 명령 인자·소스·문서·로그에 넣지 않는다. `--demo-cycles 2`로 두 번만 전송하고 종료할 수 있다.
`--demo`가 없는 기존 설치·수집·트레이 동작은 유지된다.

관리자 권한 없이 수집만 확인하려면 데이터 폴더를 따로 지정해 콘솔로 띄운다.

```powershell
src\MonitoringAgent.Worker\bin\Debug\net8.0-windows\win-x64\MonitoringAgentService.exe --data-dir C:\temp\agentdata
```

## 삭제

제어판에서 제거하거나 `MonitoringAgentApp.exe --uninstall` 실행 → 확인 → UAC.
서비스, 설치 폴더, `%ProgramData%\MonitoringAgent`, 자동 시작 등록을 지운다. 플랫폼에 쌓인 데이터는 남는다.
