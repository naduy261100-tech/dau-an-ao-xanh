import { onRequestGet as getHealth } from "../functions/api/health.js";
import { onRequestPost as generateBackground } from "../functions/api/background.js";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};

function secure(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 404) {
  return secure(new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  }));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const context = { request, env, waitUntil: promise => ctx.waitUntil(promise) };

    if (url.pathname === "/api/health") {
      if (request.method !== "GET") return json({ message: "Phương thức không được hỗ trợ." }, 405);
      return secure(await getHealth(context));
    }

    if (url.pathname === "/api/background") {
      if (request.method !== "POST") return json({ message: "Phương thức không được hỗ trợ." }, 405);
      return secure(await generateBackground(context));
    }

    if (url.pathname.startsWith("/api/")) return json({ message: "Không tìm thấy API." }, 404);
    return secure(await env.ASSETS.fetch(request));
  }
};
