const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const yaml = require("js-yaml");

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 8);
const MAX_OUTPUT_MB = Number(process.env.MAX_OUTPUT_MB || 8);
const ALLOWED = new Set([
  ".yml", ".yaml", ".json", ".js", ".mjs", ".cjs", ".ts", ".py", ".txt",
  ".properties", ".sh", ".bash", ".toml", ".xml", ".conf", ".ini", ".md",
  ".html", ".css", ".sql", ".example"
]);

function extensionAllowed(filename, configExtensions = []) {
  const ext = path.extname(filename).toLowerCase();
  const configSet = new Set(configExtensions.map(x => String(x).toLowerCase()));
  return ALLOWED.has(ext) || configSet.has(ext) || filename.toLowerCase().endsWith(".env.example");
}

function safeName(filename) {
  const basename = path.basename(filename || "generated.txt");
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "generated.txt";
}

function parseValidation(filename, content) {
  const ext = path.extname(filename).toLowerCase();
  try {
    if (ext === ".yml" || ext === ".yaml") yaml.load(content);
    if (ext === ".json") JSON.parse(content);
    return { ok: true, note: "Basic syntax validation passed (where supported)." };
  } catch (err) {
    return { ok: false, note: `Syntax validation failed: ${err.message}` };
  }
}

async function downloadTextAttachment(attachment) {
  const sizeLimit = MAX_UPLOAD_MB * 1024 * 1024;
  if (attachment.size > sizeLimit) throw new Error(`File is larger than MAX_UPLOAD_MB (${MAX_UPLOAD_MB} MB).`);
  const response = await fetch(attachment.url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Could not download attachment (HTTP ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > sizeLimit) throw new Error(`File is larger than MAX_UPLOAD_MB (${MAX_UPLOAD_MB} MB).`);
  return buffer.toString("utf8");
}

async function createOutputFile(filename, content) {
  const outputName = safeName(filename);
  const buffer = Buffer.from(content, "utf8");
  if (buffer.length > MAX_OUTPUT_MB * 1024 * 1024) {
    throw new Error(`Generated file exceeds MAX_OUTPUT_MB (${MAX_OUTPUT_MB} MB). Ask the AI to make a smaller file.`);
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hfx-ai-"));
  const fullPath = path.join(tempDir, outputName);
  await fs.writeFile(fullPath, buffer, { mode: 0o600 });
  return { attachmentPath: fullPath, filename: outputName, validation: parseValidation(outputName, content) };
}

module.exports = { extensionAllowed, safeName, downloadTextAttachment, createOutputFile, parseValidation };
