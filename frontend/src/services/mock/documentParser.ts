import { strFromU8, unzipSync, gunzipSync } from "fflate";
import type { ProjectFileType } from "@/types";

export interface TextEntry { path: string; text: string }
export interface ParsedUpload { name: string; kind: ProjectFileType; entries: TextEntry[]; notes: string[] }
const MAX_BYTES = 24 * 1024 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const CODE = /\.(?:ts|tsx|js|jsx|java|cs|py|go|rs|c|cpp|h|php|rb|sql|vue|kt|swift|html|css|json|ya?ml|xml|properties)$/i;

function archive(bytes: Uint8Array): Record<string, Uint8Array> {
  let total = 0;
  let files = 0;
  return unzipSync(bytes, { filter: (entry) => {
    if (entry.name.endsWith("/")) return false;
    total += entry.originalSize;
    if (++files > 4000 || total > MAX_BYTES || entry.originalSize > MAX_FILE_BYTES) {
      throw new Error("브라우저 분석 한도(압축 해제 24MB, 파일당 2MB, 4,000개)를 초과했습니다. 분석 범위를 줄여 다시 올려주세요.");
    }
    return !/(^|\/)(?:node_modules|\.git|bin|obj|\.next|vendor)\//.test(entry.name);
  } });
}

function xmlDocument(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("문서 내부 XML을 읽을 수 없습니다.");
  return doc;
}
function elements(node: Document | Element, name: string): Element[] {
  return Array.from(node.getElementsByTagNameNS("*", name));
}

export async function parseUpload(file: File, kind: ProjectFileType): Promise<ParsedUpload> {
  if (file.size > MAX_BYTES) throw new Error("브라우저 단독 분석은 파일당 24MB까지 지원합니다. 더 큰 파일은 전체 스택에서 분석해주세요.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase();
  if ((ext === "docx" || ext === "xlsx") && (bytes[0] !== 0x50 || bytes[1] !== 0x4b)) {
    throw new Error("문서가 암호화·보호되어 있거나 올바른 DOCX/XLSX 파일이 아닙니다. 보호를 해제한 문서 또는 MD·PDF로 변환한 규칙 문서를 올려주세요.");
  }
  const result: ParsedUpload = { name: file.name, kind, entries: [], notes: [] };
  if (kind === "SOURCE") {
    if (ext !== "zip") throw new Error("소스 코드는 ZIP 파일로 올려주세요.");
    for (const [path, content] of Object.entries(archive(bytes))) {
      if (CODE.test(path)) result.entries.push({ path, text: strFromU8(content) });
    }
    if (!result.entries.length) throw new Error("ZIP 안에 분석 가능한 소스 파일이 없습니다.");
    return result;
  }
  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // The worker and fonts are bundled locally; no CDN or API is needed offline.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: bytes, cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", useWorkerFetch: true, isEvalSupported: false }).promise;
    try {
      if (pdf.numPages > 400) throw new Error("PDF는 400쪽까지 지원합니다.");
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const text = content.items.map((item) => "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "").join("");
        result.entries.push({ path: `${file.name} · ${n}쪽`, text });
      }
    } finally { await pdf.destroy(); }
    if (!result.entries.some((e) => e.text.trim())) throw new Error("PDF에 추출 가능한 본문이 없습니다. 스캔 문서는 OCR 후 올려주세요.");
  } else if (ext === "docx") {
    const zip = archive(bytes);
    if (!zip["word/document.xml"]) throw new Error("올바른 DOCX 문서가 아닙니다.");
    const doc = xmlDocument(strFromU8(zip["word/document.xml"]));
    result.entries.push({ path: file.name, text: elements(doc, "p").map((p) => elements(p, "t").map((t) => t.textContent ?? "").join("")).join("\n") });
  } else if (ext === "xlsx") {
    const zip = archive(bytes);
    const shared = zip["xl/sharedStrings.xml"] ? elements(xmlDocument(strFromU8(zip["xl/sharedStrings.xml"])), "si").map((el) => elements(el, "t").map((t) => t.textContent ?? "").join("")) : [];
    for (const [path, content] of Object.entries(zip).filter(([path]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))) {
      const doc = xmlDocument(strFromU8(content));
      const rows = elements(doc, "row").map((row) => elements(row, "c").map((c) => {
        const v = elements(c, "v")[0]?.textContent ?? "";
        return c.getAttribute("t") === "s" ? shared[Number(v)] ?? "" : c.getAttribute("t") === "inlineStr" ? elements(c, "t").map((t) => t.textContent ?? "").join("") : v;
      }).join(" | "));
      result.entries.push({ path: `${file.name} · ${path.split("/").pop()}`, text: rows.join("\n") });
    }
    if (!result.entries.length) throw new Error("XLSX에서 읽을 수 있는 시트를 찾지 못했습니다.");
  } else if (kind === "LOG" && (ext === "zip" || ext === "gz")) {
    if (ext === "zip") {
      for (const [path, content] of Object.entries(archive(bytes))) if (/\.(log|txt|out|json|csv)$/i.test(path)) result.entries.push({ path, text: strFromU8(content) });
    } else {
      // Read through a bounded output buffer to reject decompression bombs.
      const inflated = gunzipSync(bytes, { out: new Uint8Array(MAX_BYTES + 1) });
      if (inflated.length > MAX_BYTES) throw new Error("압축 해제한 로그가 24MB를 초과합니다.");
      result.entries.push({ path: file.name, text: strFromU8(inflated) });
    }
  } else if (["md", "txt", "csv", "log", "out", "json"].includes(ext ?? "")) {
    result.entries.push({ path: file.name, text: strFromU8(bytes) });
  } else if (kind !== "ETC") {
    throw new Error("이 형식은 브라우저에서 파싱할 수 없습니다. 규칙 문서는 MD·PDF·XLSX·DOCX로 변환해 올려주세요.");
  }
  return result;
}

export async function saveParsedFile(id: number, parsed: ParsedUpload): Promise<void> {
  const db = await openFiles();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(parsed, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("브라우저 저장 공간이 부족합니다."));
  });
  db.close();
}

export async function readParsedFile(id: number): Promise<ParsedUpload | undefined> {
  const db = await openFiles();
  const value = await new Promise<ParsedUpload | undefined>((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(id);
    request.onsuccess = () => resolve(request.result as ParsedUpload | undefined);
    request.onerror = () => reject(new Error("저장한 파일을 읽지 못했습니다."));
  });
  db.close();
  return value;
}

export async function deleteParsedFiles(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await openFiles();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    for (const id of ids) tx.objectStore("files").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("브라우저의 시연 파일을 초기화하지 못했습니다."));
  });
  db.close();
}

function openFiles(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mp.parsed-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("브라우저 파일 저장소를 열지 못했습니다."));
  });
}
