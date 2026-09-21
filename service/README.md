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
