# Codex OAuth 직접 연결의 근거와 범위

2026-09-21에 공식 문서와 `openai/codex` 공개 소스의 커밋 `3938a27c1dd635eff02a624f6d64799639aeb714`를 확인했다. 이 PC의 로그인 도구는 `codex-cli 0.155.0-alpha.9.2`이며 `codex login --help`에서 `login`, `-c`, `--device-auth`를 확인했다. 이 문서는 실제 모델 호출 성공이나 특정 워크스페이스의 사용 권한을 증명하지 않는다.

## 연결 계약

| 항목 | 로컬 OAuth | 배포 API |
|---|---|---|
| URL | `https://chatgpt.com/backend-api/codex/responses` | `https://api.openai.com/v1/responses` |
| 인증 | 프로젝트 전용 `auth.json`의 `tokens.access_token` | 배포 secret의 `OPENAI_API_KEY` |
| 계정 선택 | 로그인에서 선택한 `tokens.account_id`를 `ChatGPT-Account-ID` 헤더로 사용 | 배포 API key에 연결된 프로젝트 |
| 전송 | HTTP POST, SSE 수신, 완료 이벤트까지 검증 | HTTP POST, JSON 완료 응답 |
| 모델 | 필수 `CODEX_MODEL`, 임의 기본값 없음 | 필수 `OPENAI_MODEL`; 기존 예시 모델은 `gpt-4.1-mini` |
| 실패 | 안전한 오류 반환; API 어댑터 호출 없음 | 안전한 오류 반환; OAuth 파일 접근 없음 |

두 엔드포인트의 용도는 [OpenAI의 Codex agent loop 설명](https://openai.com/index/unrolling-the-codex-agent-loop/)에 나와 있다. 로그인 파일의 구조는 [AuthDotJson](https://github.com/openai/codex/blob/3938a27c1dd635eff02a624f6d64799639aeb714/codex-rs/login/src/auth/storage.rs)과 [TokenData](https://github.com/openai/codex/blob/3938a27c1dd635eff02a624f6d64799639aeb714/codex-rs/login/src/token_data.rs), 인증 헤더 처리는 [공식 provider 인증 구현](https://github.com/openai/codex/blob/3938a27c1dd635eff02a624f6d64799639aeb714/codex-rs/model-provider/src/auth.rs)을 근거로 한다.

OAuth 요청은 `input` 메시지 배열, `instructions`, `store: false`, `stream: true`와 구조화 출력용 `text.format`을 사용한다. 공개 [ResponsesApiRequest 및 TextFormat](https://github.com/openai/codex/blob/3938a27c1dd635eff02a624f6d64799639aeb714/codex-rs/codex-api/src/common.rs)에 근거하며, 이 구조에 없는 일반 API의 `max_output_tokens`를 OAuth 요청에 복사하지 않는다. `tool_choice: auto`는 [공식 요청 생성 코드](https://github.com/openai/codex/blob/3938a27c1dd635eff02a624f6d64799639aeb714/codex-rs/core/src/client.rs)의 값이며, 이 앱에서는 `tools: []`로 도구를 제공하지 않는다. 서버가 지원하지 않는 필드나 모델을 거부하면 오류로 처리하고 유료 API로 우회하지 않는다.

HTTP 클라이언트는 이 프로젝트 자신의 식별자를 사용한다. `Codex Desktop`, 공식 CLI의 User-Agent, 내부 originator 또는 브라우저 쿠키를 흉내 내지 않는다. 공식 클라이언트 전용 인증 확장이나 접근 제한을 재현·우회하지 않는다. 리디렉션으로 인증 정보를 다른 URL에 전달하지 않는다.

## 현재 제품이 사용하는 기능

현재 호출자는 규칙 문서의 검사 규칙 추출과 incident 설명 생성 두 곳이다. 둘 다 구조화된 JSON 결과를 한 번 받아 처리한다. 브라우저로 텍스트 delta를 전달하는 기능, 대화 세션, 도구 실행, embeddings, 음성, 이미지 생성은 기존 제품에 없다. 이번 변경에서도 해당 기능을 추가하거나 OAuth로 대체한다고 주장하지 않는다.

Codex HTTP SSE는 전송 청크와 이벤트 경계가 같다고 가정하지 않는다. 최대 1 MiB 안에서 청크를 수집하며 완전한 종료 이벤트를 받으면 HTTP 연결 종료를 기다리지 않는다. `response.output_item.done`의 완성된 항목을 모으고 `response.completed`를 확인한 뒤 구조화 JSON을 검증한다. 마지막 completed 이벤트에 `output` 배열이 없는 형식도 처리하며, 텍스트 delta만으로는 성공하지 않는다. 실패, 미완료, 중간 연결 종료, 취소와 시간초과를 구분한다. 기존 제품은 결과를 한 번에 받으므로 토큰 단위 UI 스트리밍을 새로 제공하지 않는다. 근거는 [Codex SSE 구현](https://github.com/openai/codex/blob/3938a27c1dd635eff02a624f6d64799639aeb714/codex-rs/codex-api/src/sse/responses.rs)과 [공식 Responses 스트리밍 설명](https://developers.openai.com/api/docs/guides/streaming-responses)이다. 요청하지 않은 도구 호출을 실행하지 않는다.

Codex 공개 클라이언트의 [HTTP 스트림 연결](https://github.com/openai/codex/blob/3938a27c1dd635eff02a624f6d64799639aeb714/codex-rs/codex-api/src/endpoint/responses.rs)은 `Accept: text/event-stream`을 요청하고 받은 바이트를 SSE로 해석한다. 이 어댑터도 응답 Content-Type이나 SSE의 선택적인 event 이름을 필수로 가정하지 않는다. 고정된 HTTPS 엔드포인트의 성공 응답에서 실제 프레임 경계, JSON `type`, 완료 상태, 출력 내용을 검증한다. HTML이나 불완전한 텍스트를 생성 성공으로 받아들이지 않는다.

기존 UI의 `OPENAI` 표시는 모델이 생성한 설명/규칙이라는 기존 데이터 계약을 유지한다. OAuth와 API key 선택은 서버 내부 설정이며 일반 제품 화면에 추가하지 않는다. `LOCAL`은 기존 규칙·템플릿 결과이고 실제 모델 생성과 구분된다. 개발자 진단 명령에서 실제 연결 경로를 확인한다.

## 로그인과 호환성 한계

[공식 인증 문서](https://learn.chatgpt.com/docs/auth)에 따라 별도의 프로젝트 전용 `CODEX_HOME`에서 `cli_auth_credentials_store=file`, `forced_login_method=chatgpt`로 로그인한다. 필요하면 `forced_chatgpt_workspace_id`로 개발자가 지정한 워크스페이스만 허용할 수 있다. 기본 개발용 인증 파일은 복사하지 않는다. 부모 Codex 실행 환경의 `CODEX_HOME`도 바꾸지 않는다.

앱은 매 요청마다 최신 파일에서 필요한 인증 정보를 읽으며 토큰을 갱신하거나 저장하지 않는다. 만료·인증 실패는 프로젝트의 로컬 로그인 명령을 다시 실행해서 해결한다. CLI 자체의 인증 갱신과 이 앱의 동작을 혼동하지 않는다.

이 연결은 **Codex 클라이언트용 백엔드의 직접 연동**이다. 공개 범용 OpenAI API와 동일한 지원·안정성·호환성을 보장하지 않는다. 공개 소스에 필드가 존재한다는 사실은 계정별 모델 접근 권한의 보장이 아니다. 워크스페이스 사용 조건, 프로모션 혜택, 사용량 제한과 비용은 계정 설정과 적용되는 조건에 따라 달라지며 무제한 또는 무료라고 단정하지 않는다.

배포는 별도의 [공식 OpenAI API 인증 계약](https://developers.openai.com/api/reference/overview)을 사용한다. 프로모션으로 받은 문자열을 검증 없이 API key로 저장하지 않는다. 실제 배포 API key는 배포 서비스의 secret으로만 공급한다.
