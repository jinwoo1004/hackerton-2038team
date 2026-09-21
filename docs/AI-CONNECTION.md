# AI 연결: 로컬 OAuth / 배포 API key

기존 Java 17/Spring Boot 백엔드 안에서 연결 계층만 분리한다. Frontend/Agent → Spring Boot → FastAPI 구조와 제품 UI는 유지한다. 별도 프록시나 Codex 추론 프로세스를 실행하지 않는다. 기존 분석과 장애 설명의 구조화 JSON만 지원한다.

## 설정 계약

| APP_RUNTIME | LLM_PROVIDER | 필수 설정 | 네트워크 |
|---|---|---|---|
| `local` | `codex_oauth` | `CODEX_MODEL`, `CODEX_AUTH_FILE` | Codex OAuth 엔드포인트만 |
| `deployed` | `openai_api` | `OPENAI_MODEL`, `OPENAI_API_KEY` | 일반 OpenAI Responses API만 |
| `test` | `mock` | 추가 인증 없음 | 모델 네트워크 요청 없음 |

`mock`은 테스트 전용 provider 값이다. 두 실제 provider의 이름을 테스트용으로 재해석하지 않는다. runtime/provider 누락·오타·잘못된 조합은 시작 전에 설정 오류로 종료한다. `NODE_ENV`, 호스트명, API key 존재 여부로 provider를 추측하지 않는다. 로컬 production build는 여전히 `local/codex_oauth`이며 배포 미리보기는 `deployed/openai_api`로 설정한다.

선택 환경변수 `LLM_TIMEOUT_SECONDS`는 API 응답 본문 또는 OAuth의 완전한 종료 이벤트까지의 제한 시간이며 기본 4초, 허용 범위 1–60초다. 긴 모델 응답의 진단에는 명시적으로 늘릴 수 있으나, 장애 카드의 표시 시간에도 영향을 주므로 데모에서는 필요한 값만 사용한다. 모델이나 provider는 시간초과 때문에 자동 변경되지 않는다. Java 설정은 프로세스의 위 대문자 환경변수만 사용하며 Spring 속성 별칭이나 `--app.llm.*` 인수로 경로를 바꿀 수 없다.

로컬 OAuth의 인증·모델 접근·429·시간초과·연결 오류는 API key로 전환되지 않는다. 로컬 프로세스에 API key가 있어도 로컬 어댑터는 사용하지 않으며 데모 런처는 해당 key를 자식 프로세스에 전달하지 않는다. 배포는 OAuth 파일을 검사하거나 읽지 않는다. API key가 없으면 시작에 실패한다.

## 최초 로그인

로그인 도구는 PowerShell 7, 전체 데모 실행은 PowerShell 7.4 이상과 설치된 Codex CLI가 필요하다. OUT에서 실행한다.

```powershell
.\llm.ps1 -Action Login -Model gpt-6-astra
```

예시 모델은 이 개발 PC의 기존 Codex 설정에서 확인한 모델명이다. 모델 접근 권한을 보장하거나 자동 선택하지 않는다. 자신의 워크스페이스에서 사용 가능한 모델을 `-Model`에 명시한다. 공식 브라우저에서 본인 계정으로 로그인하고 해커톤 워크스페이스를 선택한다. 관리자가 제공한 워크스페이스 UUID로 고정하려면 `-WorkspaceId '<workspace-uuid>'`를 추가한다.

인증 저장소는 `%LOCALAPPDATA%\2038-monitoring\codex`이며 저장소 밖에 있다. 다른 프로젝트 전용 외부 위치는 `-AuthDirectory`로 지정할 수 있다. 개인 `~/.codex`나 저장소 내부, junction/symlink 경유 위치는 허용하지 않는다. 로그인 자식 프로세스에만 `CODEX_HOME`을 설정하고 `cli_auth_credentials_store=file`, `forced_login_method=chatgpt`를 강제한다. 기본 개발용 로그인 파일을 읽거나 복제하지 않는다. 인증 파일을 채팅에 붙여 넣을 필요가 없다.

로그인 성공 시 같은 PowerShell 세션의 로컬 설정이 준비된다. 새 터미널에서는 아래 환경변수를 명시한다.

```powershell
$env:APP_RUNTIME = 'local'
$env:LLM_PROVIDER = 'codex_oauth'
$env:CODEX_MODEL = 'gpt-6-astra'  # 자신의 워크스페이스 모델로 지정
$env:CODEX_AUTH_FILE = Join-Path $env:LOCALAPPDATA '2038-monitoring/codex/auth.json'
.\llm.ps1 -Action Diagnose
```

진단은 모델을 호출하지 않는다. 정상 출력은 runtime/provider/model/authConfigured이며 토큰·인증 내용·파일 경로를 출력하지 않는다. 모델 호출 없이 인증의 존재/형식/만료를 확인하는 것과 실제 접근 성공은 다르다.

## 로컬 개발과 데모 영상

```powershell
# 최초 사전 준비. 모델 추론을 실행하지 않는다.
.\demo.ps1 -Action Prepare -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000

# 위 local/codex_oauth 환경변수를 설정한 같은 PowerShell에서
.\demo.ps1 -Offline -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000

# 로그인 후 최소 구조화 출력 1회만 실제 확인할 때 명시적으로 실행
.\llm.ps1 -Action Smoke
```

`-Offline`은 준비된 빌드와 의존성을 사용한다는 뜻이다. `local/codex_oauth`의 실제 모델 호출에는 인터넷이 필요하다. 성공한 모델 결과와 기존 `LOCAL` 규칙·템플릿 결과는 UI에서 구분된다. 모델 실패 시 기존 비AI 로컬 설명을 유지하는 경우에도 서버에 안전한 오류 코드와 안내를 남긴다. 개발자 Smoke는 같은 실패를 비0 종료로 반환한다. 이 로컬 템플릿은 API key로 재시도하는 fallback이 아니다.

API key를 전혀 사용하지 않는 반복 자동 테스트·완전 오프라인 리허설은 별도로 명시한다.

```powershell
$env:APP_RUNTIME = 'test'
$env:LLM_PROVIDER = 'mock'
.\llm.ps1 -Action Diagnose
.\llm.ps1 -Action Smoke  # 실제 모델 사용량 0
.\demo.ps1 -Offline -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000
```

test는 실제 AI 촬영을 대신한 성공 증거가 아니다. 백엔드 없는 `-Mode Frontend`도 기존 브라우저 규칙 파서·합성 시드만 사용하며 OAuth를 브라우저로 옮기지 않는다. 모드를 바꾸기 전 `demo-stop.ps1`로 소유된 데모만 중지한다.

제공된 데모 런처는 서비스를 `127.0.0.1`에 바인딩한다. 로컬에서 Java를 직접 실행하는 경우에도 `--server.address=127.0.0.1`을 지정하고 외부 포트 포워딩을 사용하지 않는다. OAuth를 전달하는 범용 프록시 엔드포인트는 제공하지 않는다.

## 재로그인

만료·인증 오류가 나면 최초와 동일한 로그인 명령을 다시 실행한다. 다른 전용 위치나 워크스페이스를 사용했다면 같은 인수를 유지한다. 앱은 매 요청마다 현재 인증 파일을 읽으므로 서버 재시작 없이 새 로그인 상태를 반영한다. 앱이 OAuth refresh 프로토콜을 구현하거나 refresh token을 사용하지 않는다.

## 배포 및 배포 미리보기

배포 서비스의 환경 설정/secret 관리자에 다음을 공급한다. `.env.example`은 설명용 placeholder이며 실제 값을 넣어 커밋하지 않는다.

```dotenv
APP_RUNTIME=deployed
LLM_PROVIDER=openai_api
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=<deployment-secret>
```

`CODEX_AUTH_FILE`과 OAuth 인증 디렉터리는 배포하지 않는다. 기존 DB/JWT/storage/분석 서비스 URL 설정은 별도로 유지한다. 이 저장소에는 특정 호스팅 서비스의 배포 파이프라인이 없으므로 배포를 실행했다고 주장하지 않는다. Java JAR를 실행할 때도 위 설정을 명시해야 한다.

배포 후 **배포 환경 안에서만** 최소 1회 호출을 실행한다.

```powershell
.\llm.ps1 -Action Smoke -AllowDeployedSmoke
```

Gradle/PowerShell 없는 JAR 배포에서는 같은 진단 클래스를 직접 실행할 수 있다. 배포 서비스와 동일한 `deployed/openai_api` 환경변수와 secret을 주입하고 아래에서 JAR 경로를 실제 배포 경로로 바꾼다. `diagnose`는 네트워크 없이 설정을 검사하고, `smoke`는 배포 API를 실제 호출한다.

```sh
java -Dfile.encoding=UTF-8 -Dloader.main=com.xisnd.monitoring.llm.LlmDiagnostic -cp monitoring-backend-0.0.1-SNAPSHOT.jar org.springframework.boot.loader.launch.PropertiesLauncher diagnose
java -Dfile.encoding=UTF-8 -Dloader.main=com.xisnd.monitoring.llm.LlmDiagnostic -cp monitoring-backend-0.0.1-SNAPSHOT.jar org.springframework.boot.loader.launch.PropertiesLauncher smoke
```

이 명령은 배포 API 사용량을 소비할 수 있으므로 자동 테스트에서 실행하지 않는다. 프로모션으로 받은 문자열을 로컬 설정에 저장하거나 로컬 테스트에 사용하지 않는다. API key는 실제 API 플랫폼에서 발급한 배포용 secret으로 관리한다.

## 지원 범위와 검증

자격증명과 원문 upstream 오류를 로그에 남기지 않으며, 미완성 SSE 출력은 성공으로 반환하지 않는다. 통신 실패·제한·지원되지 않는 모델·취소를 안전한 공통 오류로 처리한다. 두 어댑터가 사용하는 구조화 출력 이외의 대화 이력, tool execution, embeddings, 음성, 이미지 기능은 추가하지 않았다.

2026-09-21에 프로젝트 전용 OAuth 로그인과 `gpt-6-astra`의 최소 구조화 JSON 실호출이 성공했다. 이 확인은 제한 시간을 60초로 설정했으며 기본 4초 안의 응답이나 전체 업무 프롬프트의 품질을 보장하지 않는다. 배포 API 경로는 합성 응답으로 계약을 검증했고, 실제 API key를 사용한 호출은 실행하지 않았다. `gpt-4.1-mini`는 기존 배포 모델 예시로 유지한 이름이며 이번 작업에서 해당 모델의 실접근을 확인한 것은 아니다.

[공식 소스에 근거한 프로토콜 차이와 제한](CODEX-PROTOCOL.md), [이번 변경의 독립 검증 결과](LLM-VERIFICATION.md)를 확인한다. Codex OAuth 직접 연결은 공식 범용 API와 동일한 지원·호환성을 보장하지 않는다. 특정 워크스페이스의 무료·무제한 혜택을 가정하지 않는다.
