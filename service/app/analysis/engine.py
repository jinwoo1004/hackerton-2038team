import math
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
from uuid import uuid4

from app.analysis.logs import analyze_logs
from app.analysis.project_rules import parse_rule_documents
from app.analysis.rules import CATEGORY_LABELS, CRITICAL, INFO, WARNING
from app.analysis.source import FindingCollector, scan_source
from app.analysis.summary import build_summary, grade_of
from app.core.config import get_settings
from app.schemas.analysis import AnalysisRequest, AnalysisResponse, AnalysisStatus

SEVERITY_ORDER = {CRITICAL: 0, WARNING: 1, INFO: 2}
MAX_FINDINGS = 800


def _resolve(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    p = Path(path)
    if not p.is_absolute():
        p = Path(get_settings().storage_location) / p
    return str(p)


def _score(critical: int, warning: int, info: int, code_lines: int) -> int:
    kloc = max(1.0, code_lines / 1000)
    density = (critical * 12 + warning * 3 + info * 0.5) / kloc
    return max(0, min(100, round(100 * math.exp(-density / 45))))


def _log_findings(logs: dict, findings: FindingCollector) -> None:
    for group in logs["topErrors"]:
        fatal = group["level"] == "FATAL"
        severity = CRITICAL if fatal else WARNING if group["count"] >= 10 else INFO
        findings.add(
            rule_id="L001", category="logs", severity=severity,
            title="반복되는 치명 오류" if fatal else "반복되는 오류 로그",
            message=f"같은 유형의 {group['level']} 로그가 {group['count']:,}번 발생했습니다.",
            snippet=group["sample"], recommendation="발생 시점의 요청과 스택 트레이스를 확인하세요.",
        )


class AnalysisEngine:

    def __init__(self) -> None:
        self._results: Dict[str, AnalysisResponse] = {}

    def analyze(self, request: AnalysisRequest) -> dict:
        findings = FindingCollector()
        notes: list[str] = []

        names = {_resolve(k): v for k, v in request.fileNames.items()}
        rules = parse_rule_documents([_resolve(p) for p in request.ruleFiles if p], names)
        for doc in rules.documents:
            if not doc["parsed"]:
                notes.append(f"규칙 문서 {doc['name']}: {doc['note']}")

        source_path = _resolve(request.sourceFile)
        source: dict = {"available": False}
        if source_path:
            if not Path(source_path).exists():
                notes.append("소스 ZIP 파일을 찾을 수 없습니다.")
            elif not zipfile.is_zipfile(source_path):
                notes.append("소스 파일이 올바른 ZIP 형식이 아닙니다.")
            else:
                source = scan_source(source_path, rules, findings)
                if source["skippedFiles"]:
                    notes.append(f"용량·형식 문제로 {source['skippedFiles']}개 파일은 건너뛰었습니다.")

        logs = analyze_logs([_resolve(p) for p in request.logFiles if p], names) if request.logFiles else {"available": False}
        if logs.get("available"):
            _log_findings(logs, findings)
            for name in logs["unreadable"]:
                notes.append(f"로그 파일 {name} 을(를) 읽지 못했습니다.")

        critical = findings.severity[CRITICAL]
        warning = findings.severity[WARNING]
        info = findings.severity[INFO]
        score = _score(critical, warning, info, source.get("codeLines", 0))

        categories = []
        for key, label in CATEGORY_LABELS.items():
            c = findings.by_category.get(key)
            categories.append({
                "key": key, "label": label,
                "count": sum(c.values()) if c else 0,
                "critical": c[CRITICAL] if c else 0,
                "warning": c[WARNING] if c else 0,
                "info": c[INFO] if c else 0,
            })

        items = sorted(findings.items, key=lambda f: (SEVERITY_ORDER[f["severity"]], f["category"], f["file"] or "", f["line"] or 0))
        result = {
            "overview": {"score": score, "grade": grade_of(score), "critical": critical, "warning": warning, "info": info},
            "source": source,
            "categories": categories,
            "findings": items[:MAX_FINDINGS],
            "truncated": len(items) > MAX_FINDINGS,
            "rules": rules.to_dict(),
            "logs": logs,
            "notes": notes,
            "analyzedAt": datetime.now().isoformat(timespec="seconds"),
        }
        if not source.get("available") and not logs.get("available"):
            result["notes"].insert(0, "분석할 소스 ZIP 이나 로그 파일이 없습니다. 프로젝트 파일을 등록한 뒤 다시 분석하세요.")
        return result

    def run(self, request: AnalysisRequest) -> AnalysisResponse:
        analysis_id = f"ANL-{uuid4().hex[:8].upper()}"
        try:
            result = self.analyze(request)
            response = AnalysisResponse(
                analysisId=analysis_id,
                status=AnalysisStatus.COMPLETED,
                projectCode=request.projectCode,
                summary=build_summary(request.projectCode, result),
                result=result,
                createdAt=datetime.now(),
            )
        except Exception as e:  # 분석 실패도 결과로 돌려준다
            response = AnalysisResponse(
                analysisId=analysis_id,
                status=AnalysisStatus.FAILED,
                projectCode=request.projectCode,
                summary=f"분석 중 오류가 발생했습니다: {e}",
                createdAt=datetime.now(),
            )
        self._results[analysis_id] = response
        if len(self._results) > 200:
            self._results.pop(next(iter(self._results)))
        return response

    def get(self, analysis_id: str) -> Optional[AnalysisResponse]:
        return self._results.get(analysis_id)
