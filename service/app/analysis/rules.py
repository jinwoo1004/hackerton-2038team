import re
from dataclasses import dataclass, field

CRITICAL, WARNING, INFO = "CRITICAL", "WARNING", "INFO"

CATEGORY_LABELS = {
    "quality": "코드 품질",
    "errors": "오류 위험",
    "security": "보안 이슈",
    "performance": "성능",
    "rules": "프로젝트 규칙",
    "logs": "로그",
}

JVM = {"Java", "Kotlin", "Scala"}
JS = {"JavaScript", "TypeScript", "Vue", "Svelte"}
BRACE_TRY = JVM | JS | {"C#", "Dart", "PHP", "Swift"}


@dataclass
class LineRule:
    id: str
    category: str
    severity: str
    title: str
    recommendation: str
    pattern: re.Pattern
    languages: set | None = None
    config_too: bool = False
    skip_comments: bool = True
    mask: bool = False
    exclude: re.Pattern | None = field(default=None)


def r(p: str, flags=re.IGNORECASE) -> re.Pattern:
    return re.compile(p, flags)


LINE_RULES: list[LineRule] = [
    LineRule("Q001", "quality", INFO, "처리되지 않은 TODO/FIXME",
             "남은 작업을 이슈로 옮기거나 처리 후 주석을 정리하세요.",
             r(r"\b(TODO|FIXME|HACK|XXX)\b", 0), skip_comments=False),

    LineRule("E001", "errors", WARNING, "비어 있는 catch 블록",
             "예외를 삼키지 말고 로그를 남기거나 상위로 전달하세요.",
             r(r"catch\s*(\([^)]*\))?\s*\{\s*\}"), BRACE_TRY),
    LineRule("E002", "errors", WARNING, "printStackTrace 사용",
             "로거(slf4j 등)로 예외를 기록하세요.",
             r(r"\.printStackTrace\s*\(\s*\)"), JVM),
    LineRule("E003", "errors", WARNING, "모든 예외를 잡는 except",
             "처리할 예외 타입을 명시하세요.",
             r(r"^\s*except\s*:"), {"Python"}),
    LineRule("E004", "errors", INFO, "디버그 출력문",
             "운영 코드에서는 로거를 사용하세요.",
             r(r"\b(System\.(out|err)\.print(ln)?|console\.(log|debug)|printf?\s*\(\s*\"DEBUG)"), JVM | JS | {"C#"}),
    LineRule("E005", "errors", INFO, "지나치게 넓은 예외 처리",
             "Exception 전체보다 구체적인 예외를 잡으세요.",
             r(r"catch\s*\(\s*(final\s+)?(Exception|Throwable|RuntimeException)\s+\w+\s*\)", 0), JVM | {"C#"}),

    LineRule("S001", "security", CRITICAL, "하드코딩된 비밀값",
             "비밀번호·키는 환경변수나 시크릿 저장소로 옮기세요.",
             r(r"(password|passwd|pwd|secret|api[_-]?key|access[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key|client[_-]?secret)\w*[\"']?\s*[:=]\s*[\"'][^\"'\s$%{}<>]{4,}[\"']"),
             config_too=True, mask=True,
             exclude=r(r"(example|sample|dummy|changeme|placeholder|your[_-]|xxxx|\*\*\*\*|\$\{)")),
    LineRule("S002", "security", CRITICAL, "AWS 액세스 키 노출",
             "키를 즉시 폐기하고 시크릿 저장소를 사용하세요.",
             r(r"\bAKIA[0-9A-Z]{16}\b", 0), config_too=True, skip_comments=False, mask=True),
    LineRule("S003", "security", CRITICAL, "개인 키 포함",
             "개인 키 파일은 저장소에서 제거하고 키를 재발급하세요.",
             r(r"-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----", 0), config_too=True, skip_comments=False),
    LineRule("S004", "security", WARNING, "문자열 연결로 만든 SQL",
             "PreparedStatement 나 바인딩 파라미터를 사용하세요.",
             r(r"[\"']\s*(select|insert|update|delete)\b[^\"']*[\"']\s*\+\s*\w"), ),
    LineRule("S005", "security", WARNING, "동적 코드 실행(eval)",
             "eval·exec 대신 명시적인 파싱이나 매핑을 사용하세요.",
             r(r"(?<![\w.])(eval|exec)\s*\(|new\s+Function\s*\("), JS | {"Python", "PHP"}),
    LineRule("S006", "security", WARNING, "셸 명령 실행",
             "입력값이 명령에 섞이지 않도록 인자 배열 방식으로 호출하세요.",
             r(r"Runtime\.getRuntime\(\)\.exec|os\.system\s*\(|shell\s*=\s*True|child_process\.exec\s*\("), ),
    LineRule("S007", "security", WARNING, "SSL 검증 비활성화",
             "인증서 검증을 끄지 마세요.",
             r(r"verify\s*=\s*False|rejectUnauthorized\s*:\s*false|TrustAll|NoopHostnameVerifier|InsecureSkipVerify\s*:\s*true"),
             config_too=True),
    LineRule("S008", "security", INFO, "취약한 해시 알고리즘",
             "비밀번호 해시는 BCrypt·Argon2, 무결성은 SHA-256 이상을 사용하세요.",
             r(r"getInstance\(\s*\"(MD5|SHA-?1)\"|hashlib\.(md5|sha1)\s*\(|createHash\(\s*['\"](md5|sha1)"), ),
    LineRule("S009", "security", WARNING, "innerHTML 직접 삽입",
             "사용자 입력은 이스케이프하거나 textContent 를 사용하세요.",
             r(r"\.innerHTML\s*=|dangerouslySetInnerHTML"), JS),
    LineRule("S010", "security", INFO, "암호화되지 않은 HTTP 주소",
             "외부 연동은 HTTPS 를 사용하세요.",
             r(r"http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0|www\.w3\.org|schemas\.|xmlns|maven\.apache)"),
             config_too=True, skip_comments=True),

    LineRule("P001", "performance", INFO, "SELECT * 사용",
             "필요한 컬럼만 조회하면 I/O 와 네트워크 비용이 줄어듭니다.",
             r(r"select\s+\*\s+from"), config_too=True),
    LineRule("P002", "performance", INFO, "스레드 대기(sleep) 호출",
             "대기 대신 스케줄러·이벤트 기반 처리를 검토하세요.",
             r(r"Thread\.sleep\s*\(|time\.sleep\s*\(|TimeUnit\.\w+\.sleep"), ),
    LineRule("P003", "performance", INFO, "동기 파일 I/O",
             "요청 처리 경로에서는 비동기 API 를 사용하세요.",
             r(r"\b(readFileSync|writeFileSync|execSync)\s*\("), JS),
]

SENSITIVE_FILE_NAMES = {".env", ".env.local", ".env.production", "id_rsa", "id_dsa", "credentials", ".npmrc", ".pypirc"}
SENSITIVE_SUFFIXES = (".pem", ".key", ".p12", ".pfx", ".jks", ".keystore")

MASK_VALUE = re.compile(r"([:=]\s*[\"'])([^\"']{2})[^\"']*([\"'])")


def mask_secret(line: str) -> str:
    masked = MASK_VALUE.sub(lambda m: f"{m.group(1)}{m.group(2)}****{m.group(3)}", line)
    return re.sub(r"AKIA[0-9A-Z]{12}", "AKIA************", masked)
