const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requestCounts = new Map();

const PROMPTS = {
  rice: [
    "Create a highly photorealistic travel photograph of Hồng Thái, Tuyên Quang, northern Vietnam, captured by a professional documentary photographer with a full-frame camera and a natural 35mm lens.",
    "Vertical 4:5 portrait composition from human eye level, not aerial. Beautiful layered green terraced rice fields, distant forested limestone mountains, subtle morning haze and a soft pale-blue sky.",
    "The most important requirement is a realistic open walking path or firm grassy-earth terrace edge entering from the bottom center and leading naturally toward the middle distance. Keep a clear, level, believable standing area in the lower center foreground so a visitor can be composited there at true human scale.",
    "Natural late-morning light, realistic shadows falling gently to the right, neutral white balance, subtle atmospheric depth, detailed rice leaves and soil, authentic northern Vietnamese landscape, editorial travel photography, not a painting or illustration.",
    "No people, no animals, no houses, no cars, no boats, no signs, no text, no lettering, no logos, no watermark, no fantasy, no artificial HDR, no over-saturation, no exaggerated clarity."
  ].join(" ")
};

const PHOTO_FALLBACKS = {
  rice: {
    url: "https://images.pexels.com/photos/29127885/pexels-photo-29127885.jpeg?auto=compress&cs=tinysrgb&w=1800",
    attribution: "Q. Hưng Phạm / Pexels"
  }
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

async function photoFallback(scene) {
  const fallback = PHOTO_FALLBACKS[scene] || PHOTO_FALLBACKS.rice;
  const response = await fetch(fallback.url, {
    headers: { "user-agent": "DauAnAoXanh-Checkin/2.0" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    try { await response.body?.cancel(); } catch (_) {}
    throw new Error("Không tải được ảnh phong cảnh dự phòng.");
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "content-type": response.headers.get("content-type") || "image/jpeg",
      "cache-control": "no-store, private, max-age=0",
      "x-content-type-options": "nosniff",
      "x-background-source": "photo-fallback",
      "x-background-attribution": fallback.attribution,
      "content-disposition": "inline; filename=\"hong-thai-tuyen-quang-background.jpg\""
    }
  });
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
  const scene = "rice";

  try {
    const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: PROMPTS[scene],
      steps: 4,
      seed: Math.floor(Math.random() * 2147483647)
    });

    if (!result || typeof result.image !== "string" || !result.image) {
      throw new Error("Workers AI returned no image payload.");
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
        "x-background-source": "flux-ai",
        "content-disposition": "inline; filename=\"hong-thai-ai-background.jpg\""
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || "Unknown Workers AI error");
    console.error("Workers AI background generation failed:", detail.slice(0, 500));

    try {
      // A real portrait photograph of Tuyen Quang is the no-cost fallback.
      // The source photo is framed for a standing visitor, rather than a lake-only panorama.
      return await photoFallback(scene);
    } catch (fallbackError) {
      console.error("Real-photo background fallback failed:", fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      return json({
        message: "AI tạo nền đang bận và ảnh phong cảnh dự phòng cũng chưa tải được. Vui lòng thử lại sau ít phút."
      }, 503);
    }
  }
}