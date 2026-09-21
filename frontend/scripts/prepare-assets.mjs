import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdf = path.join(root, "node_modules/pdfjs-dist");
const output = path.join(root, "public/pdfjs");
mkdirSync(output, { recursive: true });
function copyDirectory(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const target = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(path.join(source, entry.name), target);
    else if (entry.isFile()) copyFileSync(path.join(source, entry.name), target);
  }
}
copyFileSync(path.join(pdf, "legacy/build/pdf.worker.min.mjs"), path.join(output, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts"]) copyDirectory(path.join(pdf, dir), path.join(output, dir));
copyFileSync(path.join(pdf, "LICENSE"), path.join(output, "LICENSE"));
copyDirectory(path.join(root, "../demo-fixtures"), path.join(root, "public/demo"));
console.log("Prepared local PDF worker/fonts and deterministic demo input files.");
