// Lightweight ring-buffer for recent console output so the bug-report
// modal can attach it to every report. Wraps console.{log,info,warn,
// error,debug} at app boot; original behaviour is preserved. Ring
// size kept small (100) to bound memory and keep the report payload
// reasonable.

export interface ConsoleEntry {
  level: "log" | "info" | "warn" | "error" | "debug";
  ts: string;
  message: string;
}

const MAX_ENTRIES = 100;
const buffer: ConsoleEntry[] = [];

function serialize(args: unknown[]): string {
  return args
    .map((a) => {
      if (a === undefined) return "undefined";
      if (a === null) return "null";
      if (typeof a === "string") return a;
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ""}`;
      try {
        return JSON.stringify(a, null, 0);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

function push(level: ConsoleEntry["level"], args: unknown[]) {
  try {
    buffer.push({ level, ts: new Date().toISOString(), message: serialize(args).slice(0, 2000) });
    if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  } catch {
    /* never throw from console hooks */
  }
}

let installed = false;
export function installConsoleCapture(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  (["log", "info", "warn", "error", "debug"] as const).forEach((level) => {
    const original = console[level];
    console[level] = (...args: unknown[]) => {
      push(level, args);
      try { original.apply(console, args as []); } catch { /* ignore */ }
    };
  });
  // Capture uncaught errors + unhandled promise rejections too.
  window.addEventListener("error", (e) => {
    push("error", [`window.error: ${e.message}`, e.filename, `${e.lineno}:${e.colno}`]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    push("error", ["unhandledrejection:", e.reason]);
  });

  // Wrap fetch so network errors and non-2xx responses land in the
  // ring buffer. Most "errors" vendors see in DevTools are 4xx/5xx
  // responses that the app never explicitly console.errors, so without
  // this the bug report often comes back empty even when something
  // clearly went wrong.
  const originalFetch = window.fetch?.bind(window);
  if (originalFetch) {
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const started = performance.now();
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      try {
        const res = await originalFetch(input, init);
        const ms = Math.round(performance.now() - started);
        if (!res.ok) {
          // Don't consume the response body — clone it so the caller still gets it.
          let preview = "";
          try {
            const clone = res.clone();
            const text = await clone.text();
            preview = text.slice(0, 400);
          } catch { /* ignore */ }
          push("error", [`fetch ${res.status} ${method} ${url} (${ms}ms)`, preview]);
        } else {
          push("debug", [`fetch ${res.status} ${method} ${url} (${ms}ms)`]);
        }
        return res;
      } catch (err) {
        const ms = Math.round(performance.now() - started);
        push("error", [`fetch FAILED ${method} ${url} (${ms}ms)`, err]);
        throw err;
      }
    };
  }
}

export function getConsoleLogs(): ConsoleEntry[] {
  return [...buffer];
}

export function clearConsoleLogs(): void {
  buffer.length = 0;
}
