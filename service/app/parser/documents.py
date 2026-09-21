import re
import zipfile
from pathlib import Path

TEXT_EXTENSIONS = {".md", ".txt", ".csv"}


def _xml_text(xml: str) -> str:
    xml = re.sub(r"</w:p>|<w:br/>|</row>|</si>", "\n", xml)
    xml = re.sub(r"<[^>]+>", " ", xml)
    return re.sub(r"[ \t]+", " ", xml)


def extract_text(path: str) -> tuple[str | None, str | None]:
    p = Path(path)
    if not p.exists():
        return None, "파일을 찾을 수 없습니다"
    ext = p.suffix.lower()
    try:
        if ext in TEXT_EXTENSIONS:
            raw = p.read_bytes()
            for enc in ("utf-8", "cp949"):
                try:
                    return raw.decode(enc), None
                except UnicodeDecodeError:
                    continue
            return raw.decode("utf-8", errors="replace"), None
        if ext == ".docx":
            with zipfile.ZipFile(p) as zf:
                return _xml_text(zf.read("word/document.xml").decode("utf-8", errors="replace")), None
        if ext == ".xlsx":
            with zipfile.ZipFile(p) as zf:
                parts = [n for n in zf.namelist() if n == "xl/sharedStrings.xml" or n.startswith("xl/worksheets/")]
                return "\n".join(_xml_text(zf.read(n).decode("utf-8", errors="replace")) for n in parts), None
    except (OSError, KeyError, zipfile.BadZipFile):
        return None, "문서를 읽지 못했습니다"
    return None, f"{ext or '확장자 없는'} 형식은 아직 내용을 읽을 수 없습니다"
