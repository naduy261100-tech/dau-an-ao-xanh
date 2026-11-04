const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requestCounts = new Map();

const PROMPTS = {
  rice: [
    "Photorealistic documentary travel photograph of the green rice terraces and forested mountain landscape of Tuyen Quang, northern Vietnam.",
    "Vertical portrait composition, natural 35mm camera perspective at human eye level, broad unobstructed open grassy-earth foreground in the lower 40 percent, with a believable flat natural ground plane where a single standing visitor could be composited.",
    "Layered lush rice fields, distant forested limestone mountain ridges, subtle atmospheric haze, realistic leaf and soil textures, soft late-morning daylight from the upper left, neutral-warm natural color temperature, realistic shadows, crisp but not oversharpened detail.",
    "The center of the lower foreground must remain clear and empty. No people, no animals, no buildings, no vehicles, no objects, no signs, no text, no logos, no watermark, no fantasy, no illustration, no artificial HDR, no oversaturation."
  ].join(" "),
  lake: [
    "Photorealistic documentary travel photograph of a peaceful mountain lake and forested limestone peaks in Tuyen Quang, northern Vietnam.",
    "Vertical portrait composition, natural 35mm camera perspective at human eye level, a clean natural shoreline or open grassy-earth clearing across the lower 40 percent, with a believable ground plane suitable for a standing visitor.",
    "Calm lake in the middle distance, layered green limestone mountains, soft early-morning mist, natural vegetation, realistic soil and grass texture, diffuse daylight with a consistent soft direction from upper left, neutral natural colors, realistic atmospheric depth and camera exposure.",
    "Keep the center of the lower foreground completely open and empty. No people, no animals, no buildings, no vehicles, no boats, no objects, no signs, no text, no logos, no watermark, no fantasy, no illustration, no oversaturation."
  ].join(" ")
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private, max-age=0",
      "x-content-type-options": "nosniff"
    }
  });
}

function rateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now - entry.startedAt >= WINDOW_MS) {
    requestCounts.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ message: "Yêu cầu không hợp lệ từ nguồn bên ngoài." }, 403);
  }
  if (!env.AI || typeof env.AI.run !== "function") {
    return json({ message: "Tài khoản Cloudflare chưa bật Workers AI binding." }, 503);
  }
  if (rateLimited(request)) {
    return json({ message: "Bạn vừa tạo nhiều ảnh liên tiếp. Vui lòng đợi một phút rồi thử lại." }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ message: "Không đọc được yêu cầu tạo phong cảnh." }, 400);
  }
  const scene = body && body.scene === "rice" ? "rice" : "lake";
  try {
    const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: PROMPTS[scene],
      steps: 4,
      seed: Math.floor(Math.random() * 2147483647)
    });
    if (!result || typeof result.image !== "string" || !result.image) {
      return json({ message: "Mô hình AI chưa trả về ảnh. Vui lòng thử lại sau." }, 502);
    }
    const binary = atob(result.image);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "no-store, private, max-age=0",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline; filename=\"tuyen-quang-ai-background.jpg\""
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || "Unknown Workers AI error");
    console.error("Workers AI background generation failed:", detail.slice(0, 500));
    const lower = detail.toLowerCase();
    if (lower.includes("daily free allocation") || lower.includes("used up")) {
      return json({ message: "Hạn mức AI miễn phí hôm nay đã hết. Vui lòng thử lại sau khi Cloudflare làm mới hạn mức." }, 429);
    }
    if (lower.includes("capacity") || lower.includes("temporarily exceeded") || lower.includes("busy")) {
      return json({ message: "Mô hình AI đang bận. Vui lòng thử lại sau ít phút; website không chuyển sang dịch vụ trả phí." }, 503);
    }
    return json({ message: "AI chưa tạo được phong cảnh lần này. Vui lòng thử lại sau." }, 502);
  }
}
