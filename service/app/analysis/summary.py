from app.analysis.rules import CATEGORY_LABELS


def grade_of(score: int) -> str:
    for limit, grade in ((90, "A"), (80, "B"), (70, "C"), (60, "D")):
        if score >= limit:
            return grade
    return "E"


def build_summary(project_code: str, result: dict) -> str:
    overview = result["overview"]
    source = result["source"]
    lines = [f"[{project_code}] 분석 결과 품질 점수는 {overview['score']}점({overview['grade']})입니다."]

    if source.get("available"):
        langs = ", ".join(f"{l['name']} {l['ratio']}%" for l in source["languages"][:3]) or "인식된 언어 없음"
        lines.append(f"소스 {source['analyzedFiles']:,}개 파일, 코드 {source['codeLines']:,}줄을 분석했습니다. ({langs})")
    else:
        lines.append("등록된 소스 ZIP 이 없어 코드 분석은 건너뛰었습니다.")

    total = overview["critical"] + overview["warning"] + overview["info"]
    if total == 0:
        lines.append("점검 규칙에 걸린 항목이 없습니다.")
    else:
        lines.append(f"심각 {overview['critical']}건, 주의 {overview['warning']}건, 참고 {overview['info']}건이 발견되었습니다.")
        top = sorted(result["categories"], key=lambda c: (-c["critical"], -c["warning"], -c["count"]))
        worst = [c for c in top if c["count"]][:2]
        if worst:
            lines.append("가장 먼저 볼 영역은 " + ", ".join(f"{CATEGORY_LABELS[c['key']]}({c['count']}건)" for c in worst) + "입니다.")
        if overview["critical"]:
            lines.append("심각 항목(비밀값 노출 등)은 배포 전에 반드시 조치하세요.")

    rules = result["rules"]
    if rules["documents"]:
        applied = len(rules["forbidden"]) + len(rules["customLimits"]) + len(rules.get("naming", []))
        lines.append(f"규칙 문서 {len(rules['documents'])}건에서 규칙 {applied}개를 읽어 분석에 반영했습니다.")

    logs = result["logs"]
    if logs.get("available"):
        lv = logs["levels"]
        lines.append(f"로그 {logs['lines']:,}줄 중 오류 {lv['ERROR'] + lv['FATAL']:,}건, 경고 {lv['WARN']:,}건이 있습니다.")
    return "\n".join(lines)
