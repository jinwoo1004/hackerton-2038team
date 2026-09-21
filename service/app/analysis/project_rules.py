import re
from dataclasses import dataclass, field
from pathlib import Path

from app.parser.documents import extract_text

DEFAULT_FILE_LINES = 1000
DEFAULT_FUNCTION_LINES = 100
DEFAULT_LINE_LENGTH = 160

FORBID_WORDS = re.compile(r"(금지|사용하지|쓰지\s*말|사용\s*불가|지양|하지\s*않는다|avoid|forbidden|prohibited|do not use|don't use|must not)", re.IGNORECASE)
BACKTICK = re.compile(r"`([^`]{2,60})`")
CODE_TOKEN = re.compile(r"[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)+(?:\(\))?|[A-Za-z_]\w*\(\)|@[A-Z]\w+")

FUNCTION_LIMIT = re.compile(r"(메서드|메소드|함수|method|function)[^\d\n]{0,60}(\d{1,4})\s*(줄|라인|lines?)", re.IGNORECASE)
FILE_LIMIT = re.compile(r"(파일|클래스|file|class)[^\d\n]{0,60}(\d{1,5})\s*(줄|라인|lines?)", re.IGNORECASE)
LINE_LIMIT = re.compile(r"(한\s*줄|라인\s*길이|줄\s*길이|line\s*length|column)[^\d\n]{0,60}(\d{2,4})\s*(자|글자|characters?|chars?|columns?)?", re.IGNORECASE)


@dataclass
class ProjectRules:
    documents: list = field(default_factory=list)
    forbidden: list = field(default_factory=list)
    file_lines: int = DEFAULT_FILE_LINES
    function_lines: int = DEFAULT_FUNCTION_LINES
    line_length: int = DEFAULT_LINE_LENGTH
    custom_limits: list = field(default_factory=list)
    naming: list = field(default_factory=list)
    extraction_source: str = "LOCAL"

    def to_dict(self) -> dict:
        return {
            "documents": self.documents,
            "forbidden": [f["token"] for f in self.forbidden],
            "limits": {
                "fileLines": self.file_lines,
                "functionLines": self.function_lines,
                "lineLength": self.line_length,
            },
            "customLimits": self.custom_limits,
            "naming": self.naming,
            "extractionSource": self.extraction_source,
        }


def _tokens(line: str) -> list[str]:
    found = BACKTICK.findall(line)
    if not found:
        found = CODE_TOKEN.findall(line)
    return [t.strip().rstrip("()") for t in found if len(t.strip()) >= 3]


def parse_rule_documents(paths: list[str], names: dict[str, str] | None = None) -> ProjectRules:
    rules = ProjectRules()
    seen: set[str] = set()
    for path in paths:
        name = (names or {}).get(path) or Path(path).name
        text, reason = extract_text(path)
        doc = {"name": name, "parsed": text is not None, "ruleCount": 0, "note": reason, "excerpt": (text or "")[:500]}
        if text:
            for raw in text.splitlines():
                line = raw.strip(" -*\t•")
                if not line:
                    continue
                if re.search(r"(함수|메서드|메소드|function|method)", line, re.I) and re.search(r"camelCase|snake_case|PascalCase", line):
                    convention = re.search(r"camelCase|snake_case|PascalCase", line).group()
                    rules.naming.append({"value": convention, "source": name, "text": line[:300]})
                    doc["ruleCount"] += 1
                if FORBID_WORDS.search(line):
                    for token in _tokens(line):
                        if token.lower() in seen:
                            continue
                        seen.add(token.lower())
                        rules.forbidden.append({"token": token, "source": name, "text": line[:160]})
                        doc["ruleCount"] += 1
                if m := FUNCTION_LIMIT.search(line):
                    rules.function_lines = int(m.group(2))
                    rules.custom_limits.append({"type": "functionLines", "value": rules.function_lines, "source": name, "text": line[:160]})
                    doc["ruleCount"] += 1
                elif m := FILE_LIMIT.search(line):
                    rules.file_lines = int(m.group(2))
                    rules.custom_limits.append({"type": "fileLines", "value": rules.file_lines, "source": name, "text": line[:160]})
                    doc["ruleCount"] += 1
                elif m := LINE_LIMIT.search(line):
                    rules.line_length = int(m.group(2))
                    rules.custom_limits.append({"type": "lineLength", "value": rules.line_length, "source": name, "text": line[:160]})
                    doc["ruleCount"] += 1
        rules.documents.append(doc)
    return rules


def apply_extracted_rules(rules: ProjectRules, extracted: list[dict], source: str) -> None:
    """Only a small declarative rule vocabulary is accepted; never execute generated code."""
    for item in extracted[:100]:
        kind, value = item.get("type"), item.get("value")
        name, quote = item.get("source", ""), item.get("text", "")
        if not name or not quote:
            continue
        rule = {"source": name, "text": quote[:500]}
        if kind == "forbidden" and isinstance(value, str) and 2 <= len(value) <= 80:
            rule["token"] = value.rstrip("()")
            if not any(f["token"] == rule["token"] for f in rules.forbidden):
                rules.forbidden.append(rule)
        elif kind in ("functionLines", "fileLines", "lineLength") and str(value).isdigit() and 1 <= int(value) <= 10000:
            setattr(rules, {"functionLines": "function_lines", "fileLines": "file_lines", "lineLength": "line_length"}[kind], int(value))
            rules.custom_limits.append({**rule, "type": kind, "value": int(value)})
        elif kind == "naming" and value in ("camelCase", "snake_case", "PascalCase"):
            rules.naming.append({**rule, "value": value})
    rules.extraction_source = source
