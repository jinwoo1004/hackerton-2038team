import gzip
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterator

LEVEL = re.compile(r"\b(FATAL|CRITICAL|ERROR|ERR|WARN(?:ING)?|INFO|DEBUG|TRACE)\b")
TIMESTAMP = re.compile(r"(\d{4})[-/.](\d{2})[-/.](\d{2})[ T](\d{2}):(\d{2})")
EXCEPTION = re.compile(r"\b((?:[a-z_][\w$]*\.)*[A-Z]\w*(?:Exception|Error))\b")
NORMALIZE = [
    (re.compile(r"\d{4}[-/.]\d{2}[-/.]\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?"), ""),
    (re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I), "<uuid>"),
    (re.compile(r"\b0x[0-9a-f]+\b", re.I), "<hex>"),
    (re.compile(r"\b\d+(\.\d+)*\b"), "<n>"),
    (re.compile(r"\[[^\]]{0,40}\]"), ""),
    (re.compile(r"\s+"), " "),
]
MAX_LINES = 2_000_000
LEVEL_NAMES = {"FATAL": "FATAL", "CRITICAL": "FATAL", "ERROR": "ERROR", "ERR": "ERROR",
               "WARN": "WARN", "WARNING": "WARN", "INFO": "INFO", "DEBUG": "DEBUG", "TRACE": "DEBUG"}


def _lines(path: str) -> Iterator[str]:
    p = Path(path)
    if p.suffix.lower() == ".gz":
        with gzip.open(p, "rt", encoding="utf-8", errors="replace") as f:
            yield from f
    elif p.suffix.lower() == ".zip":
        with zipfile.ZipFile(p) as zf:
            for info in zf.infolist():
                if info.is_dir() or ".." in Path(info.filename).parts:
                    continue
                with zf.open(info) as f:
                    for raw in f:
                        yield raw.decode("utf-8", errors="replace")
    else:
        with open(p, encoding="utf-8", errors="replace") as f:
            yield from f


def _normalize(message: str) -> str:
    for pattern, repl in NORMALIZE:
        message = pattern.sub(repl, message)
    return message.strip()[:180]


def analyze_logs(paths: list[str], names: dict[str, str] | None = None) -> dict:
    levels: Counter = Counter()
    groups: Counter = Counter()
    samples: dict[str, str] = {}
    exceptions: Counter = Counter()
    timeline: dict[str, dict] = defaultdict(lambda: {"error": 0, "warn": 0, "total": 0})
    files, total, unreadable = 0, 0, []

    for path in paths:
        try:
            files += 1
            for line in _lines(path):
                total += 1
                if total > MAX_LINES:
                    break
                m = LEVEL.search(line)
                level = LEVEL_NAMES[m.group(1)] if m else None
                if level:
                    levels[level] += 1
                ts = TIMESTAMP.search(line)
                if ts:
                    bucket = f"{ts.group(1)}-{ts.group(2)}-{ts.group(3)} {ts.group(4)}:00"
                    timeline[bucket]["total"] += 1
                    if level in ("ERROR", "FATAL"):
                        timeline[bucket]["error"] += 1
                    elif level == "WARN":
                        timeline[bucket]["warn"] += 1
                if level in ("ERROR", "FATAL"):
                    message = line[m.end():] if m else line
                    key = _normalize(message) or "(메시지 없음)"
                    groups[(level, key)] += 1
                    samples.setdefault(key, line.strip()[:300])
                ex = EXCEPTION.search(line)
                if ex:
                    exceptions[ex.group(1).split(".")[-1]] += 1
        except OSError:
            unreadable.append((names or {}).get(path) or Path(path).name)

    top = [
        {"level": lvl, "message": msg, "count": cnt, "sample": samples.get(msg, "")}
        for (lvl, msg), cnt in groups.most_common(10)
    ]
    ordered = sorted(timeline.items())[-48:]
    return {
        "available": bool(paths),
        "files": files,
        "lines": total,
        "levels": {k: levels.get(k, 0) for k in ("FATAL", "ERROR", "WARN", "INFO", "DEBUG")},
        "topErrors": top,
        "exceptions": [{"name": n, "count": c} for n, c in exceptions.most_common(8)],
        "timeline": [{"bucket": b, **v} for b, v in ordered],
        "unreadable": unreadable,
    }
