# 명시적 AI 설정과 로그인

LLM helper는 PowerShell 7에서, `demo.ps1` 실행 관리자는 PowerShell 7.4 이상에서 실행한다. 저장소의 `.env.example`은 설명용이며 자동으로 읽지 않는다.

| 실행 환경 | 제공자 | 필요한 설정 |
|---|---|---|
| `local` | `codex_oauth` | `CODEX_MODEL`, 저장소 밖 전용 `CODEX_AUTH_FILE` |
| `deployed` | `openai_api` | `OPENAI_MODEL`, 배포 비밀값 `OPENAI_API_KEY` |
| `test` | `mock` | 모델·인증 설정 없이 진단 모델 `mock-structured` |

환경이나 제공자를 localhost, NODE_ENV, 키 존재 여부로 추론하지 않는다. 대소문자도 정확해야 한다.
다른 제공자로 자동 전환하지 않는다. 프론트 단독 백업은 AI backend를 실행하지 않는 별도 경로다.

## 사용자 로그인

```powershell
.\llm.ps1 -Action Login -Model gpt-6-astra
# 특정 공식 workspace UUID를 제한하려면 -WorkspaceId <uuid> 추가
.\llm.ps1 -Action Diagnose
```

모델은 사용자가 명시하며 계정 접근권한·사용량을 보장하지 않는다.
Login만 Codex CLI를 실행한다. 공식 브라우저에서 로그인하고 의도한 워크스페이스를 선택한다.
추론에는 CLI를 실행하지 않으며 backend Java HTTP adapter가 담당한다.

기본 전용 인증 디렉터리는 `%LOCALAPPDATA%\2038-monitoring\codex`다.
기존 개인 `~/.codex/auth.json`을 읽거나 복사하지 않는다.
`-AuthDirectory`는 저장소와 개인 `.codex` 밖의 비어 있거나 이 스크립트가 초기화한 디렉터리여야 한다.
드라이브 루트·junction·symlink를 거부하며 현재 Windows 사용자만 접근하도록 ACL을 설정한다.

자식 `ProcessStartInfo.Environment`에만 `CODEX_HOME`을 지정한다. 부모의 예약 환경변수는 바꾸지 않는다.
로그인 자식에서 API 키와 직접 access-token 주입 변수를 제거하고,
`cli_auth_credentials_store="file"`, `forced_login_method="chatgpt"`를 강제한다.
CLI stdout/stderr와 인증 파일 내용은 출력하지 않는다. 인증 파일이 생성된 뒤 같은 PowerShell 프로세스의
`APP_RUNTIME=local`, `LLM_PROVIDER=codex_oauth`, `CODEX_MODEL`, `CODEX_AUTH_FILE`만 설정한다.
다른 PowerShell 창이나 프로세스에는 설정이 이어지지 않는다.
만료·401이면 Login을 다시 수행한다. 자체 refresh 프로토콜은 구현하지 않는다.

## 진단과 최소 호출

```powershell
# 모델 호출 없음. Gradle도 --offline 사용.
.\llm.ps1 -Action Diagnose

# 현재 명시된 local 제공자로 최소 구조화 요청 1회
.\llm.ps1 -Action Smoke

# test/mock는 실제 모델 요청 0회
$env:APP_RUNTIME='test'; $env:LLM_PROVIDER='mock'
.\llm.ps1 -Action Diagnose
.\llm.ps1 -Action Smoke
```

Diagnose/Smoke는 backend `llmDiagnose`/`llmSmoke` Gradle 태스크를 호출한다.
의존성은 먼저 Prepare 또는 backend 빌드로 준비해야 한다. 출력은
성공 시 `runtime`, `provider`, `model`, `authConfigured` 정확히 네 필드만 포함하며 실패 시 안전한 `code`, `message`를 추가한다.
prompt·모델 응답·인증 경로·토큰·키·Gradle 원문을 출력하지 않는다.
종료코드는 성공0, 설정2, 인증3, 전송/응답4이다.
설정 로딩 전에 실패해 runtime/provider가 없는 Java 진단도 알려진 `code`, `message`만 보존한다.
Windows의 서로 다른 콘솔 코드페이지를 통과하도록 진단 JSON은 한글을 `\uXXXX`로 전송한다.
JSON을 읽으면 원래 한글 문장이 복원되며 부모 콘솔 인코딩 설정은 변경하지 않는다.
외부 프로세스에서 정확한 종료코드가 필요하면 `pwsh -File .\llm.ps1 -Action Diagnose`를 사용한다.
`pwsh -Command`로 감쌀 때는 끝에 `exit $LASTEXITCODE`를 넣어 PowerShell의 실패코드1 정규화를 피한다.

배포 smoke는 배포 환경에서 `APP_RUNTIME=deployed`, `LLM_PROVIDER=openai_api`,
`OPENAI_MODEL`, `OPENAI_API_KEY`를 명시한 뒤 별도 `-AllowDeployedSmoke`까지 지정해야 한다.
이 명령은 로컬 검증에서 실행하지 않는다. HTTP proxy endpoint는 만들지 않는다.

`scripts/llm/test-config.ps1`은 프로세스·로그인·자격증명·네트워크 호출 없이 셸 경계를 검증한다.
`scripts/llm/test-diagnostic.ps1`은 Java test/mock의 잘못된 timeout 설정(exit2)과 저장소 밖 임시 합성 만료 인증 파일(exit3)을 사용해 실제 프로세스 종료코드와 정확한 한글 메시지를 검증한다. 실제 로그인 파일이나 모델 요청은 사용하지 않는다.
로그인 옵션은 [OpenAI 인증 문서](https://learn.chatgpt.com/docs/auth)와
[구성 참조](https://learn.chatgpt.com/docs/config-file/config-reference)를 따른다.
