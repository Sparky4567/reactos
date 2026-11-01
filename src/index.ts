import { serve } from "bun";
import index from "./index.html";

const server = serve({
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