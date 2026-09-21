# 5분 시연 안내

## 사전 준비와 실행

Windows에서 Node.js, JDK 17, .NET 8 SDK가 필요하다. Python 3.11은 준비 명령이 프로젝트의 `.tools`에 설치한다. OUT 폴더에서 PowerShell로 실행한다.

```powershell
# 처음 한 번: 의존성과 전체/백업 모드 production build 준비
.\demo.ps1 -Action Prepare

# 현장: 준비된 파일만 사용해 전체 스택 실행
.\demo.ps1 -Offline
```

처음부터 `demo.ps1` 하나만 실행해도 온라인 준비 후 전체 스택을 기동한다. 현장 오프라인 시연은 사전 준비를 완료한 상태에서 시작한다. 기본 주소는 http://localhost:3200/login 이며 데모 계정은 `admin@xisnd.com` / `test1234`다. 로그인 후 `단지서버 월패드 연동 데모` 프로젝트가 준비되어 있다. 분석이 진행 중이면 완료될 때까지 잠시 기다린다.

현재 개발 PC에는 별도 원본 프로토타입이 기본 포트를 사용 중이어서 검증 시 아래 대체 포트를 사용한다. 기존 프로세스는 종료하지 않는다.

```powershell
.\demo.ps1 -Action Prepare -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000
.\demo.ps1 -Offline -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000
```

이 경우 http://localhost:13200/login 을 연다. 준비 때 사용한 BackendPort와 시작 때의 값은 같아야 한다. 포트를 바꾸면 프런트 API 주소가 바뀌므로 Prepare를 다시 실행한다.

## 5분 클릭 순서와 발표 대본

| 시간 | 화면과 동작 | 발표 문장 |
| --- | --- | --- |
| 0:00–0:30 | 로그인 → 프로젝트 목록 → 단지서버 월패드 연동 데모 | “프로젝트 코드 하나로 소스, 운영 규칙, 서버 지표와 로그를 연결합니다.” |
| 0:30–1:20 | 프로젝트 분석 탭 → 결과와 규칙 finding 열기 | “같은 코드라도 프로젝트 규칙을 함께 읽습니다. 이 결과는 실제 ZIP과 규칙 문서에서 계산한 69점이며, 문서 인용과 코드 위치를 확인할 수 있습니다.” |
| 1:20–2:00 | 에이전트 탭 → ONLINE 확인 → 로그 탭 → CPU·메모리·디스크 차트 | “시연 Agent가 합성 지표와 로그를 전달합니다. 실제 운영 서버에 장애를 만들지 않고 수집 흐름을 재현합니다.” |
| 2:00–2:50 | 모니터링 → 안전 장애 시연 → 응답 지연 트리거 | “평소 120ms 응답이 3200ms로 증가하고 Timeout 8건, 오류 3건이 발생한 상황입니다. 사건과 근거가 함께 등록됩니다.” |
| 2:50–3:40 | 사건의 AI 설명 → 근거·가능 원인·권장 조치 확인 | “확정 원인과 가설을 구분합니다. 키가 있으면 OpenAI가 설명하고, 연결이 없어도 동일 관측값을 사용한 로컬 설명으로 자동 전환합니다.” |
| 3:40–4:20 | Slack 메시지 미리보기 | “이 미리보기는 외부로 보내지 않습니다. 실제 Webhook을 등록한 경우에만 알림 테스트와 발송을 사용할 수 있습니다.” |
| 4:20–5:00 | 정상 복구 → 모니터링 정상 집계 → 개요의 사건 추이 | “복구 처리와 전체 상태가 함께 갱신되고, 발생·해결 기록이 남아 다음 대응에 활용됩니다.” |

오류 급증 시연을 선택하면 응답시간 450ms, Timeout 2건, 오류 24건을 보여준다. 트리거를 반복 클릭해도 같은 시나리오의 진행 중 사건을 중복 생성하지 않는다. 발생한 사건 두 개가 있으면 정상 복구가 모두 해결한다. LOCAL/OPENAI 표시는 실제 생성 경로이며, 로컬 설명을 OpenAI 결과라고 표시하지 않는다.

## 즉석 등록과 문서 파싱 시연

`/projects/new`에서 기본정보 → 기술스택 → 프로젝트 규칙 → 소스 ZIP → 확인 및 저장의 기존 5단계를 진행한다. 새 고유 Project Code를 사용한다.

- 소스: `demo-fixtures/wallpad-source.zip`.
- 규칙: `rules.md`, `rules.pdf`, `rules.xlsx`, `rules.docx` 중 하나. 같은 5개 규칙을 담고 있어 형식별 본문 추출을 비교할 수 있다.
- 로그: `gaepo-synthetic.log`, `buksuwon-synthetic.log`.

기본 seed는 MD 한 개와 소스 ZIP, 두 합성 로그를 사용한다. 같은 규칙의 여러 형식을 동시에 넣으면 규칙의 중복 적용 범위에 따라 finding 수가 달라질 수 있으므로 형식 비교는 새 프로젝트에서 하나씩 진행한다. 문서에서 금지한 console.log/eval, 함수 길이, 한 줄 길이, camelCase 이름 위반의 문서명과 인용, 소스 위치를 확인한다.

브라우저 단독 모드도 파일을 실제로 읽어 분석한다. 브라우저 메모리 보호를 위해 파일당 24MB, 압축 해제 총 24MB, 내부 파일당 2MB와 4,000개 제한이 있다. 전체 스택의 업로드 제한과 동일하지 않으며 큰 프로젝트는 전체 스택에서 분석한다. 스캔 PDF의 OCR이나 암호화 문서 해제는 지원하지 않는다.

## 중지와 복구

```powershell
.\demo.ps1 -Action Status
.\demo-stop.ps1
.\demo-reset.ps1
```

Stop은 현재 OUT 실행 기록에 있는 PID·시작시각·실행파일이 모두 일치하는 프로세스만 종료한다. Reset은 먼저 중지한 다음 `.demo`의 DB·업로드·Agent 상태를 지우고 준비된 빌드를 유지한다. 원본 ZIP, 소스와 fixture는 지우지 않는다. Reset 후 다시 시작하면 동일한 시드를 준비한다. 실행 오류는 `.demo/logs`에서 확인한다. 비밀값을 화면이나 대본에 붙여넣지 않는다.

전체 스택에 문제가 생기면 즉시 백업 모드로 전환한다.

```powershell
.\demo-stop.ps1
.\demo.ps1 -Mode Frontend -Offline

# 이 PC에서 대체 포트를 사용한다면
.\demo.ps1 -Mode Frontend -Offline -FrontendPort 13200 -BackendPort 18080 -ServicePort 18000
```

백업 모드에서는 백엔드 API 주소가 없는 별도 production build를 사용한다. 로그인 → 모니터링 → `시연 데이터 준비`로 같은 시나리오를 만든다. 준비된 샘플 파일, PDF 파서 worker와 글꼴은 로컬에서 제공하므로 인터넷이 필요 없다. 브라우저 저장 데이터의 초기화 경로는 화면의 데모 초기화 기능을 사용한다.

## OpenAI와 Slack

OpenAI 키는 실행하는 PowerShell 세션의 `OPENAI_API_KEY` 환경변수로 공급한 후 전체 스택을 시작한다. 예시의 자리표시자를 실제 소스 파일에 쓰지 않는다.

```powershell
$env:OPENAI_API_KEY = '<로컬에서만 설정하는 키>'
$env:OPENAI_MODEL = 'gpt-4.1-mini'  # 선택 사항
.\demo.ps1 -Offline
```

backend `app.llm.openai.api-key`가 환경변수를 읽으며 프런트나 Python 서비스에 키를 전달하지 않는다. 키 없음·시간초과·연결 실패·잘못된 응답에서는 로컬 규칙 추출과 근거 기반 설명으로 전환한다. 실제 OpenAI 연결 검증에는 유효한 사용자 키가 필요하다. HTTP 모의 서버 테스트 통과는 실제 OpenAI 호출 검증과 구분한다.

Slack Webhook이 없다면 incident 카드의 미리보기를 사용한다. 실제 Webhook이 있으면 설정 → 알림에서 사용자가 관리하는 테스트 채널을 등록한 뒤 테스트 발송을 실행한다. Webhook과 Agent 토큰은 저장소에 넣지 않는다.

## 현재 검증 범위

최종 검증 결과는 `docs/VERIFICATION.md`에 기록한다. 실제로 실행하지 못한 조건은 UNVERIFIED로 남긴다. 첨부된 규격 문서는 보호된 OLE EncryptedPackage이므로 본문을 읽을 수 없었고, 그 규격을 반영했다는 검증은 아직 할 수 없다. 이 제한은 유효한 MD/PDF/XLSX/DOCX의 실제 파싱 기능 검증과 별개다. 시연용 규칙과 로그는 모두 합성 입력이며 원본 운영 자료가 아니다.
