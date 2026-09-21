# AI 실행 셸 검증

2026-09-21, PowerShell 7.6.5. demo 실행 관리자는 자식 전용 환경설정을 위해 PowerShell 7.4 이상이 필요하다. 모든 아래 셸 테스트는 실제 모델·로그인·HTTP 요청을 실행하지 않았다.

| 검사 | 결과 |
|---|---|
| `scripts/llm/test-config.ps1` | PASS 21개: 누락/대소문자/조합 오류, 모델 형식/길이/개행, 상대/저장소/개인 Codex 경로 거부, test 무인증, 배포 demo 거부, 배포 선택과 smoke 별도 스위치, Login 자식 env 분리, code/message-only 오류와 exit2/3/4 매핑, 알 수 없는 오류 거부, 성공4필드 |
| `scripts/runtime/test-environment.ps1` | PASS 실제 자식8개: local/test × backend/frontend/service/agent. CODEX_HOME 항상 제거, local backend만 Codex 모델/파일 설정 보유, test backend 실제 인증 설정0, 부모 환경 보존. 가짜 sentinel만 사용 |
| `scripts/llm/test-diagnostic.ps1` | 독립 검증 PASS 2개: Java test/mock timeout typo → CONFIG_INVALID/exit2, 외부 임시 합성 만료 인증 → LOCAL_AUTH_REQUIRED/exit3. ASCII JSON, 파싱한 한글 두 문구 완전일치, 부모 Console.OutputEncoding 보존. Gradle JavaExec의 exit1을 올바르게 변환 |
| Full 시작 전 누락 설정 | PASS: APP_RUNTIME 미설정에서 프로세스 작업 전에 명확히 거부 |
| 기존 실행 보존 | PASS: 누락 설정 거부 전후 `.demo/state.json` SHA256 동일; 기존 스택 종료/초기화 없음 |
| PowerShell 구문 | PASS: llm/demo/common/test-runtime 파서 오류0 |
| 로그인 디렉터리 | MAIN이 Login을 수행한 뒤 전용 폴더·marker·auth 파일 존재만 확인. 파일 내용 읽기·복사0 |
| Java wrapper mock Diagnose/Smoke | PASS: `APP_RUNTIME=test`, `LLM_PROVIDER=mock`으로 두 명령 모두exit0. 정확히 runtime/provider/model/authConfigured 네 필드 출력, 실제 모델HTTP0 |
| local OAuth 실모델 Smoke | runtime-manager 미실행. MAIN이 담당 |
| deployed OpenAI 실모델 Smoke | 미실행. 명시된 배포 환경과 별도 -AllowDeployedSmoke가 필요한 경로 |
| 새 backend Full lifecycle | UNVERIFIED: MAIN이 허용한 전환 시점까지 기존13200/18080/18000 보존 |

성공 진단은 `runtime`, `provider`, `model`, `authConfigured` 네 필드만 출력한다.
실패 시 안전한 `code`, `message`만 추가한다. 실제 키·토큰·인증 파일 내용·CLI 출력은 기록하지 않는다.
runtime/provider가 준비되기 전 설정오류는 code/message 두 필드만으로도 인식한다. TIMEOUT은4로 매핑한다.
`pwsh -Command` 자체는 실패한 스크립트를 exit1로 정규화하므로, 외부 종료코드 확인에는 `pwsh -File` 또는 명시적 `exit $LASTEXITCODE`를 사용한다.

Windows 인코딩 경계는 Java `LlmDiagnostic` 전용 writer와 PowerShell wrapper 모두 비ASCII JSON 문자를 unicode escape하여 통과한다. 전역 콘솔 인코딩은 바꾸지 않는다.
독립 검증은 파싱한 `AI 실행 환경과 제공자 설정을 확인하세요.` 및 `로컬 로그인 명령을 다시 실행하세요.` 문구가 정확히 일치함을 확인했다.
후자는 저장소 밖 임시 합성 만료 파일만 사용했고 실제 OAuth 파일·토큰·모델 요청을 사용하지 않았다. 증거는 `docs/evidence/llm/diagnostic.json`에 있다.

실행 출력(두 명령 동일):

```json
{"runtime":"test","provider":"mock","model":"mock-structured","authConfigured":false}
```

초기 sandbox 실행은 Gradle 캐시 접근 제한으로 실패했고 raw 출력을 억제한 prerequisite 오류만 표시했다.
동일 test/mock 명령을 허용된 Gradle 캐시 접근 범위에서 재실행하여 통과했다. 모델 네트워크를 허용하거나 사용한 재시도가 아니다.
