# Runtime 검증 기록

아래 lifecycle 기록은 명시적 AI provider 분리 이전에 실행한 결과다. provider 분리 후 셸 경계 검증은
`scripts/llm/verification.md`를 참고한다. 새 backend를 사용하는 전체 lifecycle 재검증은 기존 실행 보존 때문에 아직 UNVERIFIED다.

2026-09-21 Windows, PowerShell 7, JDK17, Node24.11.0, Python3.11.9, .NET8.0.425.

| 검사 | 실제 결과 |
|---|---|
| `dotnet test agent/tests/MonitoringAgent.Tests/MonitoringAgent.Tests.csproj` | PASS: 27개, 실패0, 기존+합성 데이터/loopback 제한 회귀 |
| `dotnet build agent/MonitoringAgent.sln -c Release` | PASS: Worker/WPF/Tests, 경고0 오류0 |
| 실제 점유 포트3200/8080/8000 검사 | PASS: 각 충돌 거부, 기존 listener PID 유지 |
| workspace 밖 초기화 경로 | PASS: 거부 |
| orphan 복구 | PASS: 테스트 supervisor 종료 후 자식이 남음을 확인하고 해당 자식만 정리 |
| PID 재사용 보호 | PASS: 현재 PID에 틀린 생성시각을 넣은 기록 거부 |
| full stack clean start / 중복 start / stop / reset | PASS: 대체포트13200/18080/18000에서 실제 기동, 중복 실행 PID 유지, stop 후3포트 해제, reset 후 DB 제거. single-Agent 토큰 회전 계약으로도 재검증 PASS |
| 기본포트 clean start | UNVERIFIED: 별도 `C:\xisnd_dx_projects\2026-hackathon-dev` 기존 실행이 점유하여 보존함 |
| frontend 단독 offline | PASS: 백엔드·서비스를 종료한 상태에서 별도 production build를13200에 기동, 로그인 HTTP200 및 reset 확인. 브라우저 전체 동선은 session-monitor 담당 |
| C# 실제 ingest | PASS: 기존 wallpad-demo-01 토큰을 회전하고 같은 Agent ID로 ONLINE, version1.0.0-demo 확인. stdout에 heartbeat/metrics/logs 성공 sample0·1 기록. backend heartbeat 타이머는 false |
| Prepare | PASS: Python3.11.9 패키지 설치, Gradle bootJar, .NET Worker Release, Full/Frontend Next14 production build 모두성공. 소스 동결 후 최종 dual build를 재실행함 |
| 최종 소스 production build | PASS: 최종 frontend 소스18:13:35 KST 이후 Full BUILD_ID18:14:23, Frontend BUILD_ID18:14:37. 두 모드 각각19/19 정적 경로, exit0 |
| 최종 API/데이터 smoke | PASS: backend UP, service UP, system api/db/analysis/agent 모두UP. project1, Agent1대 ONLINE(version1.0.0-demo), metric61points, log17entries, 분석COMPLETED·69점·finding9개 |

안전 회귀는 `scripts/runtime/test-runtime.ps1`로 재현한다.
기존 프로세스(3200 Node PID14372, 8080 Java PID13104, 8000 Python PID9764)는 변경하지 않았다.

실제 lifecycle 명령:

```powershell
.\scripts\runtime\test-runtime.ps1 -Lifecycle -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000
```

실제 출력은 occupied port 3개, reset path, orphan recovery, reused PID,
full-stack clean/duplicate, full-stack stop, frontend-only offline/reset의 9개 PASS 줄이다.
Full 실행 시 별도 Agent를 추가하지 않으므로 frontend backup과 같은 Agent1대를 유지한다.

최종 실행 상태는 `http://localhost:13200/login` / backend18080 / service18000으로 남겨 독립 검증에 인계했다.
다음 읽기 검증은 토큰·Agent DTO를 출력하지 않고 요약만 반환한다.

```powershell
.\scripts\runtime\smoke.ps1 -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000
```
