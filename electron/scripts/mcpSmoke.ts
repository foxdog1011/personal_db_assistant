import { spawn } from "child_process";
import path from "path";

const serverPath = path.join(process.cwd(), "dist-electron", "mcp", "server.js");

async function main() {
  console.log("[MCP:SMOKE] starting server:", serverPath);
  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, MOCK_OPENAI: process.env.MOCK_OPENAI || "1" },
  });

  let started = false;
  const timer = setTimeout(() => {
    if (!started) {
      console.error("[MCP:SMOKE] timeout waiting for server start");
      try { child.kill(); } catch {}
      process.exit(1);
    }
  }, 4000);

  const onLine = (data: Buffer) => {
    const s = data.toString();
    process.stdout.write(s);
    if (s.includes("[MCP] Server started")) {
      started = true;
      clearTimeout(timer);
      console.log("[MCP:SMOKE] ok — server started (tools registered)");
      try { child.kill(); } catch {}
      process.exit(0);
    }
  };

  child.stdout.on("data", onLine);
  child.stderr.on("data", onLine);
  child.on("exit", (code) => {
    if (!started) {
      console.error("[MCP:SMOKE] server exited with code", code);
      clearTimeout(timer);
      process.exit(1);
    }
  });
}

main().catch((e) => {
  console.error("[MCP:SMOKE] error", e);
  process.exit(1);
});

