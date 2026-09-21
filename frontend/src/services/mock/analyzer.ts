import type { AnalysisFinding, AnalysisResult, FindingCategory, RuleStats } from "@/types";
import type { ParsedUpload, TextEntry } from "./documentParser";

interface QuotedRule { source: string; text: string }
interface Forbidden extends QuotedRule { token: string }
interface Naming extends QuotedRule { style: "camelCase" | "snake_case" | "PascalCase" }
const CATEGORIES: Record<FindingCategory, string> = { quality: "코드 품질", errors: "오류 가능성", security: "보안", performance: "성능", rules: "프로젝트 규칙", logs: "로그" };
const FORBID = /금지|사용하지|쓰지\s*말|사용\s*불가|지양|avoid|forbidden|prohibited|do not use|must not/i;

export function analyzeUploads(files: ParsedUpload[], now = new Date().toISOString()): AnalysisResult {
  const sourceFiles = files.filter((f) => f.kind === "SOURCE").flatMap((f) => f.entries);
  const logFiles = files.filter((f) => f.kind === "LOG").flatMap((f) => f.entries);
  if (!sourceFiles.length && !logFiles.length) throw new Error("분석할 소스 ZIP이나 로그 내용이 없습니다. 실제 소스 또는 로그 파일을 올린 뒤 다시 분석해주세요.");
  const findings: AnalysisFinding[] = [];
  const forbidden: Forbidden[] = [];
  const naming: Naming[] = [];
  const rules: RuleStats = { extractionSource: "LOCAL", documents: [], forbidden: [], limits: { fileLines: 1000, functionLines: 100, lineLength: 160 }, customLimits: [] };
  const notes: string[] = files.flatMap((f) => f.notes);
  for (const doc of files.filter((f) => f.kind === "RULE")) {
    let count = 0;
    for (const entry of doc.entries) for (const raw of entry.text.split(/\r?\n/)) {
      const text = raw.trim();
      if (!text) continue;
      const source = entry.path;
      if (FORBID.test(text)) {
        const quoted = Array.from(text.matchAll(/[`“"]([^`”"]{2,80})[`”"]/g), (m) => m[1]);
        const tokens = quoted.length ? quoted : Array.from(text.matchAll(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+(?:\(\))?|[A-Za-z_$][\w$]*\(\)/g), (m) => m[0]);
        for (const value of tokens) {
          const token = value.trim().replace(/\(\)$/, "");
          if (!token || forbidden.some((f) => f.token === token)) continue;
          forbidden.push({ token, source, text }); count++;
        }
      }
      const limitPatterns: [keyof RuleStats["limits"], RegExp][] = [
        ["functionLines", /(?:함수|메서드|메소드|function|method)[^\d\n]{0,30}(\d{1,4})\s*(?:줄|라인|lines?)/i],
        ["fileLines", /(?:파일|클래스|file|class)[^\d\n]{0,30}(\d{1,5})\s*(?:줄|라인|lines?)/i],
        ["lineLength", /(?:한\s*줄|라인\s*길이|줄\s*길이|line\s*length|column)[^\d\n]{0,30}(\d{1,4})\s*(?:자|글자|characters?|chars?|columns?)?/i],
      ];
      for (const [type, re] of limitPatterns) {
        const match = re.exec(text);
        if (!match || Number(match[1]) < 1) continue;
        rules.limits[type] = Number(match[1]);
        rules.customLimits.push({ type, value: Number(match[1]), source, text }); count++;
      }
      if (/(함수|메서드|메소드|function|method|이름|naming)/i.test(text)) {
        const style = /camelCase|snake_case|PascalCase/.exec(text)?.[0] as Naming["style"] | undefined;
        if (style) { naming.push({ style, source, text }); count++; }
      }
    }
    rules.documents.push({ name: doc.name, parsed: doc.entries.some((e) => !!e.text.trim()), ruleCount: count, note: count ? null : "본문을 읽었으며 지원하는 금지·길이·이름 규칙이 없습니다." });
  }
  rules.forbidden = forbidden.map((f) => f.token);
  const add = (finding: AnalysisFinding) => findings.push(finding);
  const origin = (type: string) => rules.customLimits.filter((l) => l.type === type).at(-1);
  let totalLines = 0, codeLines = 0, commentLines = 0, blankLines = 0, functionCount = 0;
  const largestFiles: { path: string; lines: number }[] = [];
  const longFunctions: { file: string; name: string; line: number; lines: number }[] = [];
  const languageCounts = new Map<string, { files: number; lines: number }>();
  for (const file of sourceFiles) {
    const lines = file.text ? file.text.replace(/\r?\n$/, "").split(/\r?\n/) : [];
    totalLines += lines.length;
    largestFiles.push({ path: file.path, lines: lines.length });
    const ext = file.path.split(".").pop() ?? "text";
    const language = ({ ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", java: "Java", cs: "C#", py: "Python" } as Record<string, string>)[ext] ?? ext;
    const stats = languageCounts.get(language) ?? { files: 0, lines: 0 };
    stats.files++; stats.lines += lines.length; languageCounts.set(language, stats);
    if (lines.length > rules.limits.fileLines) {
      const rule = origin("fileLines");
      add({ ruleId: "R004", category: rule ? "rules" : "quality", severity: "WARNING", title: "파일 길이 초과", message: `${file.path}: ${lines.length}줄로 ${rules.limits.fileLines}줄 기준을 초과했습니다.`, file: file.path, line: 1, ruleSource: rule?.source, ruleText: rule?.text, recommendation: "책임별로 파일을 분리하세요." });
    }
    lines.forEach((text, index) => {
      const trimmed = text.trim();
      if (!trimmed) { blankLines++; return; }
      if (/^(\/\/|#|\*|\/\*)/.test(trimmed)) { commentLines++; return; }
      codeLines++;
      const common = { file: file.path, line: index + 1, snippet: text.trim().slice(0, 500) };
      for (const rule of forbidden) {
        // Match identifiers literally; uploaded rules are never executed as code or regular expressions.
        const escaped = rule.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`(?<![\\w$])${escaped}(?![\\w$])`).test(text)) continue;
        add({ ...common, ruleId: "R001", category: "rules", severity: "WARNING", title: "규칙 문서의 금지 항목", message: `금지된 ${rule.token} 사용을 발견했습니다.`, ruleSource: rule.source, ruleText: rule.text, recommendation: `${rule.source}의 금지 기준에 따라 대체 구현으로 변경하세요.` });
      }
      if (text.length > rules.limits.lineLength) {
        const rule = origin("lineLength");
        add({ ...common, ruleId: "R003", category: rule ? "rules" : "quality", severity: "INFO", title: "한 줄 길이 초과", message: `이 줄은 ${text.length}자로 ${rules.limits.lineLength}자 기준을 초과했습니다.`, ruleSource: rule?.source, ruleText: rule?.text, recommendation: "조건식과 인자를 여러 줄로 나누세요." });
      }
      if (/\beval\s*\(/.test(text)) add({ ...common, ruleId: "S005", category: "security", severity: "WARNING", title: "동적 코드 실행", message: "eval은 입력 문자열을 코드로 실행할 수 있습니다.", recommendation: "JSON.parse 또는 명시적인 허용 목록 처리로 대체하세요." });
      if (/\b(?:System\.(?:out|err)\.print(?:ln)?|console\.(?:log|debug))/.test(text)) add({ ...common, ruleId: "E004", category: "errors", severity: "INFO", title: "디버그 출력문", message: "디버그 출력문이 운영 코드에 포함되어 있습니다.", recommendation: "운영 코드에서는 로거를 사용하세요." });
      if (/\b(?:password|secret|api[_-]?key)\s*[:=]\s*["'][^"']{5,}["']/i.test(text)) add({ ...common, snippet: "[민감할 수 있는 상수는 화면에서 숨김]", ruleId: "S-SECRET", category: "security", severity: "CRITICAL", title: "민감 설정 하드코딩", message: "민감한 설정값으로 보이는 문자열 상수가 있습니다.", recommendation: "비밀값을 환경변수 또는 비밀 저장소로 옮기세요." });
    });
    for (const fn of findFunctions(file)) {
      functionCount++;
      if (fn.lines > rules.limits.functionLines) {
        const rule = origin("functionLines");
        longFunctions.push({ file: file.path, ...fn });
        add({ ruleId: "R002", category: rule ? "rules" : "quality", severity: "WARNING", title: "함수 길이 초과", message: `${fn.name} 함수는 ${fn.lines}줄로 ${rules.limits.functionLines}줄 기준을 초과했습니다.`, file: file.path, line: fn.line, ruleSource: rule?.source, ruleText: rule?.text, recommendation: "기능별로 작은 함수로 분리하세요." });
      }
      for (const rule of naming) {
        const re = rule.style === "camelCase" ? /^[a-z][a-zA-Z0-9]*$/ : rule.style === "PascalCase" ? /^[A-Z][a-zA-Z0-9]*$/ : /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
        if (!re.test(fn.name)) add({ ruleId: "R005", category: "rules", severity: "WARNING", title: "함수 이름 규칙 위반", message: `${fn.name} 이름은 ${rule.style} 기준과 다릅니다.`, file: file.path, line: fn.line, ruleSource: rule.source, ruleText: rule.text, recommendation: `함수 이름을 ${rule.style} 형식으로 변경하세요.` });
      }
    }
  }
  const levels = { FATAL: 0, ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
  const errors = new Map<string, { level: string; message: string; count: number; sample: string }>();
  let logLines = 0;
  for (const file of logFiles) file.text.replace(/\r?\n$/, "").split(/\r?\n/).filter((l) => l.trim()).forEach((text, index) => {
    logLines++;
    const level = /\b(FATAL|ERROR|WARN|INFO|DEBUG)\b/.exec(text)?.[1] as keyof typeof levels | undefined;
    if (level) levels[level]++;
    if (level === "ERROR" || level === "FATAL") {
      const message = text.replace(/^.*?\b(?:ERROR|FATAL)\b[\s\]:-]*/, "").replace(/\b\d+\b/g, "#");
      const group = errors.get(message) ?? { level, message, count: 0, sample: text };
      group.count++; errors.set(message, group);
      if (group.count === 1) add({ ruleId: "L001", category: "logs", severity: level === "FATAL" ? "CRITICAL" : "INFO", title: "오류 로그", message: `${level} 로그: ${message}`, file: file.path, line: index + 1, snippet: text.slice(0, 500), recommendation: "같은 시간대의 요청, 응답 및 연결 상태를 확인하세요." });
    }
  });
  for (const finding of findings.filter((f) => f.ruleId === "L001")) {
    const group = Array.from(errors.values()).find((e) => finding.message.endsWith(e.message));
    if (group) { finding.message = `같은 유형의 ${group.level} 로그가 ${group.count}번 발생했습니다. ${group.message}`; if (group.count >= 10 && finding.severity !== "CRITICAL") finding.severity = "WARNING"; }
  }
  const critical = findings.filter((f) => f.severity === "CRITICAL").length;
  const warning = findings.filter((f) => f.severity === "WARNING").length;
  const info = findings.filter((f) => f.severity === "INFO").length;
  const score = Math.round(100 * Math.exp(-((critical * 12 + warning * 3 + info * .5) / Math.max(1, codeLines / 1000)) / 45));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "E";
  notes.push(`브라우저에서 실제 파일을 읽어 소스 ${sourceFiles.length}개·${codeLines}줄, 로그 ${logLines}줄을 점검했습니다. 규칙 문서 ${rules.documents.length}개에서 ${forbidden.length + rules.customLimits.length + naming.length}개 기준을 추출했습니다.`);
  notes.push("로컬 규칙 파서 사용: 금지 항목·길이·함수 이름 기준 및 정적 패턴 검사입니다. 프로그램 실행이나 전체 보안 검증을 대체하지 않습니다.");
  if (!findings.length) notes.push(`finding 0건의 근거: 위 입력에서 적용된 규칙과 기본 정적 검사에 일치하는 위반이 없었습니다. 100점은 점검 범위 내 결과이며 결함이 없다는 보장이 아닙니다.`);
  return {
    overview: { score, grade, critical, warning, info },
    source: { available: !!sourceFiles.length, analyzedFiles: sourceFiles.length, configFiles: 0, skippedFiles: 0, totalLines, codeLines, commentLines, blankLines, functions: functionCount, languages: Array.from(languageCounts, ([name, value]) => ({ name, ...value, ratio: Math.round(value.lines / Math.max(1, totalLines) * 100) })), largestFiles: largestFiles.sort((a, b) => b.lines - a.lines).slice(0, 5), longFunctions },
    categories: (Object.keys(CATEGORIES) as FindingCategory[]).map((key) => { const items = findings.filter((f) => f.category === key); return { key, label: CATEGORIES[key], count: items.length, critical: items.filter((f) => f.severity === "CRITICAL").length, warning: items.filter((f) => f.severity === "WARNING").length, info: items.filter((f) => f.severity === "INFO").length }; }),
    findings: findings.slice(0, 800), truncated: findings.length > 800, rules,
    logs: { available: !!logFiles.length, files: logFiles.length, lines: logLines, levels, topErrors: Array.from(errors.values()).sort((a, b) => b.count - a.count), exceptions: [], timeline: [] }, notes, analyzedAt: now,
  };
}

function findFunctions(file: TextEntry): { name: string; line: number; lines: number }[] {
  const lines = file.text.replace(/\r?\n$/, "").split(/\r?\n/);
  const result: { name: string; line: number; lines: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const name = /\bfunction\s+(\w+)\s*\(/.exec(text)?.[1] ?? /\bdef\s+(\w+)\s*\(/.exec(text)?.[1] ?? /\b(?:const|let)\s+(\w+)\s*=.*=>\s*\{/.exec(text)?.[1] ?? /^\s*(?:(?:public|private|protected|static|async|final|override)\s+)*(?:[\w<>,?\[\]]+\s+)?(\w+)\s*\([^;]*\)\s*(?::[^=]+)?\s*\{/.exec(text)?.[1];
    if (!name || ["if", "for", "while", "switch", "catch", "constructor"].includes(name)) continue;
    let end = i;
    if (/\bdef\b/.test(text)) {
      const indent = text.search(/\S/);
      while (end + 1 < lines.length && (!lines[end + 1].trim() || lines[end + 1].search(/\S/) > indent)) end++;
    } else {
      let depth = 0;
      let opened = false;
      for (let j = i; j < lines.length; j++) {
        const code = lines[j].replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*$/g, "");
        for (const ch of code) { if (ch === "{") { depth++; opened = true; } if (ch === "}") depth--; }
        end = j;
        if (opened && depth <= 0) break;
      }
    }
    result.push({ name, line: i + 1, lines: end - i + 1 });
  }
  return result;
}
