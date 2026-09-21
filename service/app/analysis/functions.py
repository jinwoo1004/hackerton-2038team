import re
from dataclasses import dataclass

from app.analysis.languages import BRACE_LANGUAGES

CONTROL = {"if", "for", "while", "switch", "catch", "synchronized", "return", "else", "try", "do", "using", "lock", "foreach", "when", "new"}

SIGNATURES = {
    "Java": re.compile(r"^\s*(?:@\w+\s+)*(?:(?:public|private|protected|static|final|abstract|synchronized|default|native)\s+)*[\w<>\[\],.?\s]+?\s+(\w+)\s*\([^;]*\)\s*(?:throws\s+[\w.,\s]+)?\{?\s*$"),
    "C#": re.compile(r"^\s*(?:\[[^\]]+\]\s*)*(?:(?:public|private|protected|internal|static|virtual|override|async|sealed|abstract)\s+)*[\w<>\[\],.?\s]+?\s+(\w+)\s*\([^;]*\)\s*\{?\s*$"),
    "Kotlin": re.compile(r"^\s*(?:\w+\s+)*fun\s+(?:<[^>]+>\s*)?(?:[\w.]+\.)?(\w+)\s*\("),
    "Go": re.compile(r"^\s*func\s+(?:\([^)]*\)\s*)?(\w+)\s*\("),
    "Swift": re.compile(r"^\s*(?:\w+\s+)*func\s+(\w+)"),
    "Rust": re.compile(r"^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+(\w+)"),
    "PHP": re.compile(r"^\s*(?:\w+\s+)*function\s+(\w+)\s*\("),
    "JS": re.compile(
        r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\("
        r"|^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*(?::\s*[^=]+)?=>\s*\{?\s*$"
        r"|^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+|get\s+|set\s+)*(\w+)\s*\([^;]*\)\s*(?::\s*[^{]+)?\{\s*$"
    ),
}
SIGNATURES["Scala"] = re.compile(r"^\s*(?:\w+\s+)*def\s+(\w+)")
SIGNATURES["Dart"] = SIGNATURES["Java"]
SIGNATURES["C++"] = SIGNATURES["C#"]
SIGNATURES["C"] = SIGNATURES["C#"]
SIGNATURES["C/C++"] = SIGNATURES["C#"]

PY_DEF = re.compile(r"^(\s*)(?:async\s+)?def\s+(\w+)")
STRINGS = re.compile(r"\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'|`[^`]*`")


@dataclass
class FunctionInfo:
    name: str
    start: int
    lines: int


def _signature(language: str) -> re.Pattern | None:
    if language in ("JavaScript", "TypeScript", "Vue", "Svelte"):
        return SIGNATURES["JS"]
    return SIGNATURES.get(language)


def _brace_functions(lines: list[str], language: str) -> list[FunctionInfo]:
    sig = _signature(language)
    if sig is None:
        return []
    result: list[FunctionInfo] = []
    i = 0
    n = len(lines)
    while i < n:
        m = sig.match(lines[i])
        name = next((g for g in m.groups() if g), None) if m else None
        if not name or name in CONTROL:
            i += 1
            continue
        j = i
        while j < n and j <= i + 2 and "{" not in STRINGS.sub("", lines[j]):
            if ";" in lines[j]:
                break
            j += 1
        if j >= n or "{" not in STRINGS.sub("", lines[j]):
            i += 1
            continue
        depth = 0
        k = j
        while k < n:
            code = STRINGS.sub("", lines[k])
            depth += code.count("{") - code.count("}")
            if depth <= 0 and k >= j:
                break
            k += 1
        result.append(FunctionInfo(name, i + 1, k - i + 1))
        i = j + 1
    return result


def _python_functions(lines: list[str]) -> list[FunctionInfo]:
    result: list[FunctionInfo] = []
    for i, line in enumerate(lines):
        m = PY_DEF.match(line)
        if not m:
            continue
        indent = len(m.group(1))
        end = i
        for k in range(i + 1, len(lines)):
            s = lines[k]
            if s.strip() and len(s) - len(s.lstrip()) <= indent:
                break
            if s.strip():
                end = k
        result.append(FunctionInfo(m.group(2), i + 1, end - i + 1))
    return result


def find_functions(lines: list[str], language: str) -> list[FunctionInfo]:
    if language == "Python":
        return _python_functions(lines)
    if language in BRACE_LANGUAGES or language in ("Vue", "Svelte", "Scala", "Dart"):
        return _brace_functions(lines, language)
    return []
