# Monitoring Agent Windows 설치 파일

`MonitoringAgentSetup.exe`는 Windows x64용 .NET 8 self-contained 단일 설치기다. 대상 PC에 .NET 런타임을 별도로 설치할 필요가 없다. Windows 서비스 Worker EXE를 설치기 내부에 포함한다.

| 항목 | 값 |
| --- | --- |
| 파일 버전 | 1.0.0.0 |
| 제품 버전 | 1.0.0+42bffa80e1bb28d90d9cdf2a6e561c0a2843562d |
| 소스 기준 커밋 | 42bffa80e1bb28d90d9cdf2a6e561c0a2843562d |
| RID / PE 아키텍처 | win-x64 / AMD64 |
| 빌드 SDK | .NET 8.0.425 |
| 크기 | 113,920,203 bytes (108.64 MiB) |
| Authenticode | NotSigned — 코드 서명 없음 |
| 체크섬 | SHA256SUMS |

검증 결과: Agent 테스트 27개 통과, 설치기 리소스의 Worker SHA256이 게시한 Worker와 일치, PE AMD64 및 최종 SHA256 확인. 생성한 설치기를 실행하거나 Windows 서비스를 설치하지는 않았다. 빌드 임시 디렉터리와 임시 Worker 리소스는 정리했다.

API 키, OAuth 인증 파일, 실제 서버 연결 설정, Agent 토큰은 포함하지 않는다. 설치 시 서버 주소·Agent 토큰·수집 로그 경로를 입력한다. 인증서 서명과 실제 설치 후 서비스 동작 검증은 이 산출물의 검증 범위에 포함되지 않았다.

이 EXE는 Git LFS로 버전 관리한다. 저장소를 복제한 뒤 루트에서 다음 명령으로 실제 바이너리를 받는다.

```powershell
git lfs install
git lfs pull --include="agent/dist/MonitoringAgentSetup.exe"
```

GitHub에서는 [설치 파일 페이지](https://github.com/jinwoo1004/hackerton-2038team/blob/main/agent/dist/MonitoringAgentSetup.exe)의 다운로드 버튼으로 받을 수 있다. Git LFS 포인터 텍스트는 실행 파일이 아니다.

`agent/dist` 폴더에서 파일 무결성을 확인한다.

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath .\MonitoringAgentSetup.exe
Get-Content -LiteralPath .\SHA256SUMS
```

소스에서 다시 만들려면 `agent` 폴더에서 `pwsh -NoProfile -File installer/pack-agent.ps1`을 실행한다. 상세 사용법은 [Agent README](../README.md)를 참고한다.
