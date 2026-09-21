# Analysis Service — Monitoring Platform

Python 3.11+ · FastAPI

프로젝트 소스와 운영 로그를 분석해 백엔드에 결과를 돌려주는 서비스.
**Spring Boot 만 이 서비스를 호출한다** (프런트엔드 직접 호출 없음 → CORS 를 열지 않는다).

## 실행

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt    # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux

uvicorn app.main:app --reload --port 8000
```

- 문서: http://localhost:8000/docs
- 헬스체크: http://localhost:8000/health

### 컨테이너 배포

저장소 루트에서 `docker build -f service/Dockerfile -t monitoring-analysis .`로 빌드한다.
Python 3.11, UID/GID `10001:10001`, 단일 uvicorn worker, 기본 8000 포트로 실행한다.
이미지에는 `requirements.txt`와 `app/`만 복사하며 개발용 `.env`, 로컬 로그, 인증 파일을 포함하지 않는다.

운영에는 `APP_RUNTIME=deployed`, `STORAGE_LOCATION=/data/storage`,
32자 이상의 무작위 `ANALYSIS_SHARED_SECRET`을 환경변수로 지정한다.
이 비밀값은 백엔드의 `APP_ANALYSIS_SHARED_SECRET`과 같아야 한다.
누락되거나 약한 인증 값, 상대 storage 경로를 사용하면 시작하지 않는다.

`GET /health`는 인증 없이 `{"status":"UP"}`만 반환한다. 나머지 요청은 `X-Analysis-Token`이 필요하며,
운영에서는 Swagger/OpenAPI 페이지를 제공하지 않는다. FastAPI 포트는 인터넷에 공개하지 않고 백엔드와의 내부 네트워크에만 연결한다.
서비스에 OpenAI 키나 Codex 인증 파일을 전달할 필요는 없다.

백엔드의 영속 `/data/storage` 볼륨을 동일 경로에 읽기 전용으로 연결한다.
배포 또는 shared secret 설정 시 파일 경로는 실제 경로로 해석하여 storage 밖의 절대 경로·`..`·symlink/junction 탈출을 거부한다.
기존 local/test 환경에서 인증 값을 설정하지 않으면 데모 fixture 절대 경로와 기존 요청 계약을 유지한다.
분석 결과의 영속 저장은 백엔드 DB가 담당하며 이 서비스의 최근 결과 조회 캐시는 재시작 시 초기화된다.

Docker 엔진이 없는 환경에서는 이미지 실행을 검증할 수 없다. Python 3.11의 소스 회귀는 `python -m pytest tests -q`로 별도 실행한다.

테스트:

```bash
.venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python -m pytest tests -q
```

## API

```
GET  /health
POST /analysis                 분석 요청 접수
GET  /analysis/{analysisId}    분석 결과 조회
POST /anomaly/detect           시계열 마지막 값이 평소보다 튀었는지 판단 (백엔드 이상 탐지가 5분마다 호출)
```

요청/응답 필드 이름은 백엔드 DTO 와 1:1 로 맞춰져 있다
(`app/schemas/analysis.py` ↔ `backend/.../analysis/dto/`).

```json
// POST /analysis
{
  "projectId": 1,
  "projectCode": "TREECS",
  "technologies": ["Java", "Spring Boot"],
  "ruleFiles": ["/storage/TREECS/rule/coding-guide.pdf"],
  "sourceFile": "/storage/TREECS/source/treecs-app.zip"
}
```

## 구조

```
app/
├─ main.py              FastAPI 앱
├─ api/routes.py        엔드포인트 (분석 로직은 analysis 로 위임)
├─ analysis/engine.py   분석 조합과 품질 점수
├─ analysis/summary.py  결과 요약
├─ parser/              소스 ZIP 해석
├─ schemas/             백엔드와 주고받는 계약
├─ models/              (예정) 분석 결과 저장 모델
└─ core/config.py       설정
```

## 분석 내용

`/analysis` 는 요청을 받아 동기로 분석하고 결과(`result`)를 돌려준다. 백엔드가 비동기로 호출한다.

| 모듈 | 하는 일 |
| --- | --- |
| `parser/source_archive.py` | ZIP 안전 해제(경로 조작·압축 폭탄·용량 제한), node_modules 등 제외 |
| `parser/documents.py` | 규칙 문서 텍스트 추출 (md, txt, csv, docx, xlsx) |
| `analysis/rules.py` | 줄 단위 규칙 (품질·오류 위험·보안·성능), 비밀값 마스킹 |
| `analysis/functions.py` | 함수 길이 측정 (중괄호 언어, Python) |
| `analysis/project_rules.py` | 규칙 문서에서 "금지" 항목, 함수·파일·줄 길이 기준 추출 |
| `analysis/logs.py` | 로그 레벨 집계, 오류 메시지 묶기, 예외 통계, 시간대 추이 |
| `analysis/engine.py` | 전체 조합, 품질 점수(코드 1,000줄당 가중치) |
| `analysis/anomaly.py` | EWMA 기준선과 MAD 편차로 점수 계산, 3.5 이상이고 최소 증가폭을 넘으면 이상 |

PDF 규칙 문서는 아직 내용을 읽지 않는다 (결과 notes 에 안내).
AI(LLM) 분석은 다음 단계.
