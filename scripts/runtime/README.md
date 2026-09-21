# 데모 실행 관리자

루트 `demo.ps1`은 Windows PowerShell 5.1 또는 PowerShell 7에서 실행한다.
모든 프로세스는 숨김 창으로 시작하며 상태·로그·데모 DB는 Git에서 제외한 `.demo`에 보관한다.

```powershell
# 온라인 사전 준비: Node/npm, JDK 17, .NET 8 SDK가 있어야 한다.
# Python 3.11.9는 프로젝트 .tools에만 내려받는다.
.\demo.ps1 -Action Prepare

# 현장: 추가 설치·빌드·네트워크 다운로드 없이 실행
.\demo.ps1 -Offline
.\demo.ps1 -Action Status
.\demo-stop.ps1

# 브라우저 단독 백업: 별도 production build, API 주소 미설정
.\demo.ps1 -Mode Frontend -Offline
.\demo-reset.ps1
```

사전 준비가 없으면 기본 `demo.ps1`은 온라인 Prepare 후 실행한다.
프론트 단독 환경은 `demo.ps1 -Action Prepare -Mode Frontend`로 Node/npm만 사용해 준비할 수 있다.
Full 준비는 두 프론트 production build(`.next-demo-full`, `.next-demo-frontend`),
Spring Boot jar, Python 패키지, C# Worker release build를 만든다.
빌드 이후 소스를 바꾸면 Prepare를 다시 실행한다.

기본 포트는 3200/8080/8000이다. 기존 앱을 닫을 수 없으면 별도 포트를 명시한다.

```powershell
.\demo.ps1 -Action Prepare -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000
.\demo.ps1 -Offline -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000
```

Next.js의 API 주소는 빌드 시 정해지므로 BackendPort가 바뀌면 다시 Prepare해야 한다.
Start는 prepared.json에 기록된 BackendPort와 다르면 실행을 거부한다.
Stop/Reset은 포트 옵션 없이도 이 workspace가 기동한 프로세스를 정리한다.
Reset은 `.demo/data`, `.demo/storage`, `.demo/agent`만 지우며 준비된 빌드와 원본 파일은 유지한다.
브라우저 단독 데이터 초기화는 화면의 데모 초기화 동작을 사용한다.

프로세스는 PID뿐 아니라 생성시각과 실행파일 경로가 기록값과 일치할 때만 종료한다.
Supervisor가 자식 프로세스 목록을 지속 기록하므로 supervisor가 먼저 종료된 경우에도
기록된 orphan을 Stop이 정리한다. 기록되지 않은 프로세스, 포트 점유자, 다른 checkout은 종료하지 않는다.
recursive 삭제 전 절대경로가 workspace 내부인지 확인하고 junction/symlink가 있으면 거부한다.
동시 명령과 중복 실행은 mutex·기존 소유 프로세스 및 건강상태로 확인한다.

OpenAI 키는 사용자가 실행 환경에 넣으면 backend가 상속받는다. 런처는 키를 출력하거나 파일에 저장하지 않는다.
기존 seed Agent의 토큰을 demo 전용 API로 회전하여 메모리로 받아 자식 환경에만 전달하며 PID 기록·config 파일에는 넣지 않는다.
실제 C#이 전송할 때 backend의 합성 heartbeat 타이머는 꺼서 같은 1대의 Agent를 보여준다.
`-SkipAgent`는 C# 실행 없이 backend의 합성 seed Agent만 보여주는 복구용 옵션이다.

## 회귀 검증

```powershell
# 기존 포트 점유자 보호, workspace 경로 보호, PID 재사용 방지, orphan 정리
.\scripts\runtime\test-runtime.ps1

# 준비 완료 후 clean start, 중복 기동, stop, fallback, reset까지 검사
.\scripts\runtime\test-runtime.ps1 -Lifecycle -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000

# 실행 중인 데모의 건강상태·Agent·실제 분석/지표/로그 요약(토큰 출력 없음)
.\scripts\runtime\smoke.ps1 -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000
```

실제 실행 결과는 `verification.md`에 기록한다. 준비 도중 실패하면 기존 프로세스는 건드리지 않는다.
기동 도중 실패하면 그 기동에서 기록한 프로세스만 정리하고 `.demo/logs`를 남긴다.
