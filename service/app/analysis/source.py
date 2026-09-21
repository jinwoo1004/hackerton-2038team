import re
from collections import Counter, defaultdict
from pathlib import PurePosixPath

from app.analysis.functions import find_functions
from app.analysis.languages import is_comment, is_config, language_of
from app.analysis.project_rules import DEFAULT_FUNCTION_LINES, ProjectRules
from app.analysis.rules import (
    CRITICAL, INFO, LINE_RULES, SENSITIVE_FILE_NAMES, SENSITIVE_SUFFIXES, WARNING, mask_secret,
)
from app.parser.source_archive import iter_entries

PER_FILE_SAMPLES = 5
LARGE_FILE_BYTES = 500 * 1024
TEST_PATH = re.compile(r"(^|/)(tests?|__tests__|spec|src/test|mocks?|fixtures?)/|\.(test|spec)\.\w+$|_test\.(py|go)$|Test\.java$", re.IGNORECASE)
DOWNGRADE = {CRITICAL: WARNING, WARNING: INFO, INFO: INFO}


class FindingCollector:
    def __init__(self) -> None:
        self.items: list[dict] = []
        self.counts: Counter = Counter()
        self.severity: Counter = Counter()
        self.by_category: dict[str, Counter] = defaultdict(Counter)
        self._per_file: Counter = Counter()

    def add(self, *, rule_id, category, severity, title, message, file=None, line=None, snippet=None, recommendation=None, rule_source=None, rule_text=None):
        self.counts[rule_id] += 1
        self.severity[severity] += 1
        self.by_category[category][severity] += 1
        key = (rule_id, file)
        self._per_file[key] += 1
        if self._per_file[key] > PER_FILE_SAMPLES:
            return
        self.items.append({
            "ruleId": rule_id, "category": category, "severity": severity, "title": title,
            "message": message, "file": file, "line": line,
            "snippet": snippet[:220] if snippet else None, "recommendation": recommendation,
            "ruleSource": rule_source, "ruleText": rule_text,
        })


def _wanted(path: str) -> bool:
    name = PurePosixPath(path).name.lower()
    return language_of(path) is not None or is_config(path) or name in SENSITIVE_FILE_NAMES or name.endswith(SENSITIVE_SUFFIXES)


def scan_source(zip_path: str, rules: ProjectRules, findings: FindingCollector) -> dict:
    lang_files: Counter = Counter()
    lang_lines: Counter = Counter()
    code_lines = comment_lines = blank_lines = 0
    analyzed = skipped = config_files = 0
    functions_total = 0
    largest: list[tuple[int, str]] = []
    long_functions: list[dict] = []
    skip_reasons: Counter = Counter()
    forbidden = [(f, re.compile(re.escape(f["token"]))) for f in rules.forbidden]

    for entry in iter_entries(zip_path, _wanted):
        name = PurePosixPath(entry.path).name.lower()
        if name in SENSITIVE_FILE_NAMES or name.endswith(SENSITIVE_SUFFIXES):
            key_file = name.endswith(SENSITIVE_SUFFIXES) or name.startswith("id_")
            findings.add(
                rule_id="S011", category="security", severity=CRITICAL if key_file else WARNING,
                title="민감한 파일 포함", message=f"{PurePosixPath(entry.path).name} 파일이 소스에 포함되어 있습니다.",
                file=entry.path, recommendation="키·환경 파일은 저장소와 배포 산출물에서 제외하세요.",
            )
        if entry.text is None:
            skipped += 1
            skip_reasons[entry.skipped or "unknown"] += 1
            continue

        language = language_of(entry.path)
        config = language is None
        lines = entry.text.splitlines()
        if config:
            config_files += 1
        else:
            analyzed += 1
            lang_files[language] += 1
            lang_lines[language] += len(lines)
            largest.append((len(lines), entry.path))

        test_code = bool(TEST_PATH.search(entry.path))
        comment_flags = []
        for text in lines:
            blank = not text.strip()
            comment = not blank and is_comment(text, language)
            comment_flags.append(comment)
            if not config:
                if blank:
                    blank_lines += 1
                elif comment:
                    comment_lines += 1
                else:
                    code_lines += 1

        for rule in LINE_RULES:
            if config and not rule.config_too:
                continue
            if rule.languages and (config or language not in rule.languages):
                continue
            for i, text in enumerate(lines):
                if rule.skip_comments and comment_flags[i]:
                    continue
                if not rule.pattern.search(text):
                    continue
                if rule.exclude and rule.exclude.search(text):
                    continue
                snippet = mask_secret(text.strip()) if rule.mask else text.strip()
                # 테스트 코드의 보안 항목은 한 단계 낮춘다
                severity = DOWNGRADE[rule.severity] if test_code and rule.category == "security" else rule.severity
                findings.add(
                    rule_id=rule.id, category=rule.category, severity=severity, title=rule.title,
                    message=rule.title + (" (테스트 코드)" if test_code else ""), file=entry.path, line=i + 1,
                    snippet=snippet, recommendation=rule.recommendation,
                )

        if config:
            continue

        for rule, pattern in forbidden:
            for i, text in enumerate(lines):
                if comment_flags[i] or not pattern.search(text):
                    continue
                findings.add(
                    rule_id="R001", category="rules", severity=WARNING, title=f"금지 규칙 위반: {rule['token']}",
                    message=f"규칙 문서에서 금지한 {rule['token']} 을(를) 사용했습니다.", file=entry.path, line=i + 1,
                    snippet=text.strip(), recommendation=f"{rule['source']}: {rule['text']}",
                    rule_source=rule['source'], rule_text=rule['text'],
                )

        long_lines = [i for i, t in enumerate(lines) if len(t) > rules.line_length]
        line_rule = next((r for r in reversed(rules.custom_limits) if r['type'] == 'lineLength'), None)
        file_rule = next((r for r in reversed(rules.custom_limits) if r['type'] == 'fileLines'), None)
        if long_lines:
            findings.add(
                rule_id="R003" if line_rule else "Q002", category="rules" if line_rule else "quality", severity=INFO, title="너무 긴 줄",
                message=f"{len(long_lines)}줄이 {rules.line_length}자를 넘습니다.", file=entry.path, line=long_lines[0] + 1,
                recommendation="줄을 나누거나 변수로 추출해 가독성을 높이세요.",
                rule_source=line_rule['source'] if line_rule else None, rule_text=line_rule['text'] if line_rule else None,
            )
        if len(lines) > rules.file_lines:
            findings.add(
                rule_id="R004" if file_rule else "Q003", category="rules" if file_rule else "quality", severity=WARNING, title="너무 긴 파일",
                message=f"{len(lines):,}줄로 기준({rules.file_lines:,}줄)을 넘습니다.", file=entry.path,
                recommendation="역할별로 파일을 나누세요.",
                rule_source=file_rule['source'] if file_rule else None, rule_text=file_rule['text'] if file_rule else None,
            )
        if entry.size > LARGE_FILE_BYTES:
            findings.add(
                rule_id="P004", category="performance", severity=INFO, title="큰 소스 파일",
                message=f"{entry.size // 1024:,}KB 크기의 소스 파일입니다.", file=entry.path,
                recommendation="생성된 코드나 번들 파일이라면 분석 대상에서 제외하세요.",
            )

        functions = find_functions(lines, language)
        for fn in functions:
            for naming in rules.naming:
                pattern = {"camelCase": r"[a-z][a-zA-Z0-9]*", "snake_case": r"[a-z][a-z0-9_]*", "PascalCase": r"[A-Z][a-zA-Z0-9]*"}[naming['value']]
                if not re.fullmatch(pattern, fn.name):
                    findings.add(rule_id="R005", category="rules", severity=WARNING, title="함수 네이밍 규칙 위반",
                        message=f"{fn.name} 함수가 {naming['value']} 기준을 따르지 않습니다.", file=entry.path, line=fn.start,
                        recommendation=f"{naming['source']}: {naming['text']}", rule_source=naming['source'], rule_text=naming['text'])
        functions_total += len(functions)
        custom = rules.function_lines != DEFAULT_FUNCTION_LINES
        for fn in functions:
            if fn.lines > rules.function_lines:
                long_functions.append({"file": entry.path, "name": fn.name, "line": fn.start, "lines": fn.lines})
                findings.add(
                    rule_id="Q004" if not custom else "R002", category="quality" if not custom else "rules",
                    severity=WARNING, title="너무 긴 함수" if not custom else "함수 길이 규칙 위반",
                    message=f"{fn.name} 함수가 {fn.lines}줄입니다. (기준 {rules.function_lines}줄)",
                    file=entry.path, line=fn.start, recommendation="작은 단위의 함수로 나누세요.",
                    rule_source=next((r['source'] for r in reversed(rules.custom_limits) if r['type'] == 'functionLines'), None),
                    rule_text=next((r['text'] for r in reversed(rules.custom_limits) if r['type'] == 'functionLines'), None),
                )

    total_lang_lines = sum(lang_lines.values()) or 1
    languages = [
        {"name": n, "files": lang_files[n], "lines": lang_lines[n], "ratio": round(lang_lines[n] / total_lang_lines * 100, 1)}
        for n, _ in lang_lines.most_common()
    ]
    largest.sort(reverse=True)
    return {
        "available": True,
        "analyzedFiles": analyzed,
        "configFiles": config_files,
        "skippedFiles": skipped,
        "skipReasons": dict(skip_reasons),
        "totalLines": code_lines + comment_lines + blank_lines,
        "codeLines": code_lines,
        "commentLines": comment_lines,
        "blankLines": blank_lines,
        "functions": functions_total,
        "languages": languages,
        "largestFiles": [{"path": p, "lines": n} for n, p in largest[:5]],
        "longFunctions": sorted(long_functions, key=lambda f: -f["lines"])[:10],
    }
