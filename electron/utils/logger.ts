import fs from "fs";
import path from "path";

type Level = "INFO" | "WARN" | "ERROR";

// Patterns that look like API keys / tokens / secrets
const SENSITIVE_KEYS = ["OPENAI_API_KEY", "apiKey", "api_key", "secret", "token", "password"];
const KEY_VALUE_RE = /\b(sk-[A-Za-z0-9_-]{10,}|sk-proj-[A-Za-z0-9_-]{10,})\b/g;

/** Deep-clone an object and redact any sensitive values */
function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj.replace(KEY_VALUE_RE, "[REDACTED]");
  if (obj instanceof Error) return redact(obj.message);
  if (Array.isArray(obj)) return obj.map(redact);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return obj;
}

/** Get or create the log file write stream for today */
let currentDate = "";
let stream: fs.WriteStream | null = null;

function getStream(): fs.WriteStream | null {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  if (stream && currentDate === today) return stream;

  // Close old stream
  if (stream) {
    try { stream.end(); } catch {}
  }

  const logsDir = path.join(process.cwd(), "logs");
  try {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    stream = fs.createWriteStream(path.join(logsDir, `app-${today}.log`), { flags: "a" });
    currentDate = today;
    return stream;
  } catch {
    // If we can't create the log file, just skip file logging
    stream = null;
    return null;
  }
}

function formatLine(level: Level, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  let line = `${ts} [${level}] ${msg}`;
  if (meta !== undefined) {
    const safe = redact(meta);
    line += " " + JSON.stringify(safe);
  }
  return line;
}

function write(level: Level, msg: string, meta?: unknown) {
  const line = formatLine(level, msg, meta);

  // Console (keep original behavior)
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);

  // File
  const s = getStream();
  if (s) s.write(line + "\n");
}

export const logger = {
  info: (msg: string, meta?: unknown) => write("INFO", msg, meta),
  warn: (msg: string, meta?: unknown) => write("WARN", msg, meta),
  error: (msg: string, meta?: unknown) => write("ERROR", msg, meta),
};
