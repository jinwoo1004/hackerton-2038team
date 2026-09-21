import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { analyzeUploads } from "../src/services/mock/analyzer";
import { localInsight, seededMetrics, slackMessage } from "../src/services/mock/demoData";
import type { ParsedUpload } from "../src/services/mock/documentParser";
import { parseUpload } from "../src/services/mock/documentParser";
import type { Incident } from "../src/types";

const source = (text: string): ParsedUpload => ({ name: "source.zip", kind: "SOURCE", entries: [{ path: "src/client.ts", text }], notes: [] });
const rules = (text: string): ParsedUpload => ({ name: "rules.md", kind: "RULE", entries: [{ path: "rules.md", text }], notes: [] });

test("actual ZIP bytes are decompressed into source and paired with actual Markdown bytes", async () => {
  const fixtures = path.resolve("../demo-fixtures");
  const zip = new File([readFileSync(path.join(fixtures, "wallpad-source.zip"))], "wallpad-source.zip");
  const md = new File([readFileSync(path.join(fixtures, "rules.md"))], "rules.md");
  const parsed = await parseUpload(zip, "SOURCE");
  const doc = await parseUpload(md, "RULE");
  assert.equal(parsed.entries[0].path, "src/WallpadClient.ts");
  assert.ok(parsed.entries[0].text.includes("parse_response"));
  const result = analyzeUploads([parsed, doc]);
  assert.ok(result.findings.some((f) => f.ruleId === "R001" && f.file === "src/WallpadClient.ts"));
});

test("same code changes findings with the uploaded rule, citing source and line", () => {
  const code = source("export function sendRequest() {\n  tracker.trace('sample');\n}");
  const without = analyzeUploads([code]);
  const withRule = analyzeUploads([code, rules("금지: `tracker.trace()` 사용 금지")]);
  assert.equal(without.findings.length, 0);
  assert.match(without.notes.join(" "), /finding 0건의 근거/);
  assert.equal(withRule.findings.length, 1);
  assert.equal(withRule.findings[0].file, "src/client.ts");
  assert.equal(withRule.findings[0].line, 2);
  assert.equal(withRule.findings[0].ruleSource, "rules.md");
  assert.match(withRule.findings[0].ruleText!, /tracker.trace/);
  assert.ok(withRule.overview.score < without.overview.score);
});

test("function length, naming, and line length apply with evidence", () => {
  const result = analyzeUploads([source("export function send_request() {\n  const message = 'long enough';\n  return message;\n}"), rules("함수는 3줄 이하\n한 줄 길이는 25자 이하\n함수 이름은 camelCase 사용")]);
  for (const id of ["R002", "R005", "R003"]) assert.ok(result.findings.some((f) => f.ruleId === id && f.ruleSource === "rules.md"));
});

test("empty input and only a rule document cannot earn a perfect score", () => {
  assert.throws(() => analyzeUploads([]), /소스 ZIP이나 로그 내용이 없습니다/);
  assert.throws(() => analyzeUploads([rules("금지 `eval()`")]), /소스 ZIP이나 로그 내용이 없습니다/);
});

test("uploaded forbidden syntax remains literal and is never executable", () => {
  const result = analyzeUploads([source("const value = 3;"), rules("금지: `(?=.+)[a-z]+`")]);
  assert.equal(result.findings.length, 0);
});

test("actual seed fixture has source-mapped rule findings and a derived non-perfect score", () => {
  const fixtures = path.resolve("../demo-fixtures");
  const result = analyzeUploads([source(readFileSync(path.join(fixtures, "source/WallpadClient.ts"), "utf8")), rules(readFileSync(path.join(fixtures, "rules.md"), "utf8"))]);
  assert.ok(result.findings.length >= 5);
  assert.ok(result.findings.some((f) => f.ruleId === "S005"));
  assert.ok(result.findings.filter((f) => f.category === "rules").every((f) => f.file && f.line && f.ruleSource));
  assert.ok(result.overview.score < 100);
});

test("metric seed is deterministic and contains 60 real points", () => {
  const anchor = "2026-09-21T09:00:00Z";
  const points = seededMetrics(anchor);
  assert.deepEqual(points, seededMetrics(anchor));
  assert.equal(points.length, 60);
  assert.equal(points[0].cpuPct, 28);
  assert.equal(points[59].diskPct, 44.95);
});

test("full deterministic fixture matches the service score and severity totals", () => {
  const fixtures = path.resolve("../demo-fixtures");
  const logs: ParsedUpload[] = ["gaepo-synthetic.log", "buksuwon-synthetic.log"].map((name) => ({ name, kind: "LOG", entries: [{ path: name, text: readFileSync(path.join(fixtures, name), "utf8") }], notes: [] }));
  const result = analyzeUploads([source(readFileSync(path.join(fixtures, "source/WallpadClient.ts"), "utf8")), rules(readFileSync(path.join(fixtures, "rules.md"), "utf8")), ...logs]);
  assert.deepEqual(result.overview, { score: 69, grade: "D", critical: 0, warning: 5, info: 4 });
  assert.equal(result.source.codeLines, 28);
  assert.equal(result.source.totalLines, 29);
  assert.equal(result.source.largestFiles?.[0].lines, 29);
});

test("source totals and longest-file counts agree for LF, CRLF, final newlines and empty files", () => {
  for (const [text, expected] of [
    ["const first = 1;\nconst second = 2;", 2],
    ["const first = 1;\nconst second = 2;\n", 2],
    ["const first = 1;\r\nconst second = 2;\r\n", 2],
    ["const first = 1;\nconst second = 2;\n\n", 3],
    ["", 0],
  ] as const) {
    const stats = analyzeUploads([source(text)]).source;
    assert.equal(stats.totalLines, expected);
    assert.equal(stats.largestFiles?.[0].lines, expected);
    assert.equal((stats.codeLines ?? 0) + (stats.commentLines ?? 0) + (stats.blankLines ?? 0), expected);
  }
});

test("both incident scenarios and Slack preview share observed values, causes and actions", () => {
  for (const scenario of ["LATENCY", "ERROR_SPIKE"] as const) {
    const insight = localInsight(scenario);
    assert.equal(insight.source, "LOCAL");
    assert.equal(insight.currentResponseMs, scenario === "LATENCY" ? 3200 : 450);
    assert.equal(insight.errorCount, scenario === "LATENCY" ? 3 : 24);
    const incident = { projectName: "단지서버 월패드 연동 데모", status: "OPEN", insight } as Incident;
    const message = slackMessage(incident);
    for (const value of [insight.serverName, String(insight.currentResponseMs), insight.causes[0], insight.actions[0]]) assert.ok(message.includes(value));
  }
});
