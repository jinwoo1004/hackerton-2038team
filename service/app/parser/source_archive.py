import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Iterator, List

IGNORED_DIRS = {
    "node_modules", ".git", ".svn", ".hg", "dist", "build", "target", "out", ".next", ".nuxt",
    "vendor", "__pycache__", ".venv", "venv", "env", "bin", "obj", ".idea", ".vscode", ".gradle",
    "coverage", ".pytest_cache", ".mypy_cache", "Pods", "DerivedData",
}
IGNORED_SUFFIXES = (".min.js", ".min.css", ".map", ".lock", "-lock.json", ".bundle.js")

MAX_ENTRIES = 20000
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_TOTAL_BYTES = 300 * 1024 * 1024
MAX_RATIO = 200


@dataclass
class ArchiveEntry:
    path: str
    size: int
    text: str | None
    skipped: str | None = None


def _is_ignored(name: str) -> bool:
    parts = PurePosixPath(name).parts
    if any(p in IGNORED_DIRS for p in parts[:-1]):
        return True
    return name.lower().endswith(IGNORED_SUFFIXES)


def _decode(raw: bytes) -> str | None:
    if b"\x00" in raw[:4096]:
        return None
    for enc in ("utf-8", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def list_entries(archive_path: str) -> List[str]:
    try:
        with zipfile.ZipFile(archive_path) as zf:
            return [
                info.filename
                for info in zf.infolist()
                if not info.is_dir() and ".." not in PurePosixPath(info.filename).parts
            ]
    except (OSError, zipfile.BadZipFile):
        return []


def iter_entries(archive_path: str, wanted) -> Iterator[ArchiveEntry]:
    total = 0
    with zipfile.ZipFile(archive_path) as zf:
        for index, info in enumerate(zf.infolist()):
            if index >= MAX_ENTRIES:
                break
            name = info.filename.replace("\\", "/")
            if info.is_dir() or ".." in PurePosixPath(name).parts or _is_ignored(name):
                continue
            if not wanted(name):
                continue
            if info.file_size > MAX_FILE_BYTES:
                yield ArchiveEntry(name, info.file_size, None, "too_large")
                continue
            # 압축 폭탄 방어
            if info.compress_size and info.file_size / info.compress_size > MAX_RATIO and info.file_size > 1024 * 1024:
                yield ArchiveEntry(name, info.file_size, None, "suspicious_ratio")
                continue
            if total + info.file_size > MAX_TOTAL_BYTES:
                yield ArchiveEntry(name, info.file_size, None, "total_limit")
                continue
            total += info.file_size
            text = _decode(zf.read(info))
            yield ArchiveEntry(name, info.file_size, text, None if text is not None else "binary")
