import { serve } from "bun";
import index from "./index.html";
import { Ollama } from "ollama-node";

function getPort(): number {
  const argIndex = process.argv.indexOf("--port");
  if (argIndex !== -1) {
    const value = process.argv[argIndex + 1];
    if (value) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  if (process.env.PORT) {
    const parsed = Number(process.env.PORT);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 3000;
}


function normalizeOllamaHost(input?: string | null): string {
  let h = (input ?? "127.0.0.1").trim();
  h = h.replace(/^https?:\/\//i, "");
  h = h.replace(/\/.*/, "");
  if (h.includes(":")) h = h.split(":")[0] ?? h;
  if (!h) h = "127.0.0.1";
  return h;
}

const server = serve({
  port: getPort(),
  idleTimeout: 255,
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      GET() {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      PUT() {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/proxy": {
      async GET(req) {
        const target = new URL(req.url).searchParams.get("url");
        if (!target) return new Response("Missing url", { status: 400 });
        let u: URL;
        try { u = new URL(target); } catch { return new Response("Bad url", { status: 400 }); }
        if (!/^https?:$/.test(u.protocol)) return new Response("Unsupported protocol", { status: 400 });
        const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
        try {
          const res = await fetch(u.toString(), {
            headers: {
              "User-Agent": CHROME_UA,
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
            redirect: "follow",
          });
          const ct = res.headers.get("content-type") ?? "text/html; charset=utf-8";
          let body = await res.text();
          if (ct.includes("text/html")) {
            const base = `<base href="${u.origin}${u.pathname}" target="_self">`;
            if (/<head[^>]*>/i.test(body)) {
              body = body.replace(/<head[^>]*>/i, (m) => m + base);
            } else {
              body = base + body;
            }
          } else if (ct.includes("text/css")) {
            const baseDir = u.href.replace(/[^/]*$/, "");
            body = body.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_m, quote: string, raw: string) => {
              const trimmed = raw.trim();
              if (/^(data:|https?:|blob:|#)/i.test(trimmed)) return `url(${quote}${trimmed}${quote})`;
              try {
                const abs = new URL(trimmed, baseDir || u.origin).href;
                return `url(${quote}${abs}${quote})`;
              } catch {
                return `url(${quote}${trimmed}${quote})`;
              }
            });
            body = body.replace(/@import\s+(['"])([^'"]+)\1/gi, (_m, quote: string, raw: string) => {
              const trimmed = raw.trim();
              if (/^(data:|https?:|blob:|#)/i.test(trimmed)) return `@import ${quote}${trimmed}${quote}`;
              try {
                const abs = new URL(trimmed, baseDir || u.origin).href;
                return `@import ${quote}${abs}${quote}`;
              } catch {
                return `@import ${quote}${trimmed}${quote}`;
              }
            });
          }
          return new Response(body, {
            status: res.status,
            headers: { "Content-Type": ct, "X-Proxy-URL": u.toString() },
          });
        } catch (e) {
          return new Response("Proxy error: " + (e as Error).message, { status: 502 });
        }
      },
    },

    "/api/ollama/models": {
      async GET(req) {
        const url = new URL(req.url);
        const host = normalizeOllamaHost(url.searchParams.get("host"));
        try {
          const ollama = new Ollama(host);
          const data = await ollama.listModels();
          return Response.json({ host, models: data.models, complete: data.complete });
        } catch (e) {
          return Response.json({ host, error: (e as Error).message, models: [], complete: [] }, { status: 502 });
        }
      },
    },

    "/api/ollama/chat": {
      async POST(req) {
        let body: any = {};
        try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
        const host = normalizeOllamaHost(body?.host);
        const model = String(body?.model ?? "").trim();
        const messages = Array.isArray(body?.messages) ? body.messages : (body?.prompt ? [{ role: "user", content: String(body.prompt) }] : []);
        if (!model) return Response.json({ error: "Missing model" }, { status: 400 });

        const base = `http://${host}:11434`;
        let upstream: Response;
        try {
          upstream = await fetch(`${base}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages, stream: true }),
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 502 });
        }
        if (!upstream.ok || !upstream.body) {
          let errMsg = `Upstream HTTP ${upstream.status}`;
          try {
            const j = await upstream.json();
            if (j?.error) errMsg = typeof j.error === "string" ? j.error : JSON.stringify(j.error);
          } catch {}
          return Response.json({ error: errMsg }, { status: upstream.status || 502 });
        }

        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            const send = (obj: any) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
            const reader = upstream.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let doneSent = false;
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const l of lines) {
                  const trimmed = l.trim();
                  if (!trimmed) continue;
                  try {
                    const j = JSON.parse(trimmed);
                    if (j?.error) {
                      send({ type: "error", message: typeof j.error === "string" ? j.error : JSON.stringify(j.error) });
                      continue;
                    }
                    const text = j?.message?.content;
                    if (text) send({ type: "token", text });
                    if (j?.done && !doneSent) {
                      doneSent = true;
                      send({ type: "done" });
                    }
                  } catch {
                    // ignore partial json
                  }
                }
              }
              if (buffer.trim()) {
                try {
                  const j = JSON.parse(buffer.trim());
                  const text = j?.message?.content;
                  if (text) send({ type: "token", text });
                  if (j?.done && !doneSent) {
                    doneSent = true;
                    send({ type: "done" });
                  }
                } catch {}
              }
              if (!doneSent) send({ type: "done" });
            } catch (e) {
              send({ type: "error", message: (e as Error).message });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      },
    },

    "/api/hello/:name": (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);