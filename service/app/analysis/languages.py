from pathlib import PurePosixPath

LANGUAGE_BY_EXT = {
    ".java": "Java", ".kt": "Kotlin", ".kts": "Kotlin", ".py": "Python",
    ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript", ".cs": "C#", ".cpp": "C++", ".cc": "C++",
    ".cxx": "C++", ".hpp": "C++", ".h": "C/C++", ".c": "C", ".go": "Go", ".php": "PHP",
    ".rb": "Ruby", ".swift": "Swift", ".rs": "Rust", ".scala": "Scala", ".dart": "Dart",
    ".vue": "Vue", ".svelte": "Svelte", ".sql": "SQL", ".sh": "Shell", ".ps1": "PowerShell",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS",
}

# 코드는 아니지만 비밀값 점검 대상
CONFIG_EXTS = {".yml", ".yaml", ".properties", ".xml", ".json", ".env", ".ini", ".conf", ".toml", ".gradle"}
CONFIG_NAMES = {".env", "dockerfile", ".npmrc", ".pypirc"}

BRACE_LANGUAGES = {"Java", "Kotlin", "JavaScript", "TypeScript", "C#", "C++", "C", "C/C++", "Go", "PHP", "Swift", "Rust", "Scala", "Dart"}
HASH_COMMENT = {"Python", "Ruby", "Shell", "PowerShell"}


def language_of(path: str) -> str | None:
    return LANGUAGE_BY_EXT.get(PurePosixPath(path).suffix.lower())


def is_config(path: str) -> bool:
    p = PurePosixPath(path)
    name = p.name.lower()
    return p.suffix.lower() in CONFIG_EXTS or name in CONFIG_NAMES or name.startswith(".env")


def is_comment(line: str, language: str | None) -> bool:
    s = line.strip()
    if not s:
        return False
    if language in HASH_COMMENT:
        return s.startswith("#")
    if language == "SQL":
        return s.startswith("--")
    if language in ("HTML", "Vue", "Svelte") and s.startswith("<!--"):
        return True
    return s.startswith(("//", "/*", "*", "*/"))
