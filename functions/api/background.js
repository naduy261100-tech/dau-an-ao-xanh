const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requestCounts = new Map();

const BACKGROUNDS = {
  "rice-gold": {
    title: "Golden terraced rice fields",
    author: "Quang Nguyen Vinh / Pexels",
    url: "https://images.pexels.com/photos/14025282/pexels-photo-14025282.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic editorial travel photograph of golden terraced rice fields in northern Vietnam, shot with a full-frame camera and natural 35mm lens. Vertical 4:5 composition, natural human-eye viewpoint, layered golden rice terraces and dark forested mountains in the distance, a narrow earthy footpath or terrace edge in the lower foreground where a visitor can naturally stand, soft late afternoon daylight, realistic atmospheric depth, balanced exposure and natural colors. No people, no text, no logos, no watermark, no illustration, no fantasy."
  },
  "rice-green": {
    title: "Green terraced valley",
    author: "Duc Nguyen / Pexels",
    url: "https://images.pexels.com/photos/35872968/pexels-photo-35872968.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic travel photograph of a lush green terraced rice valley in northern Vietnam, vertical 4:5 frame from human eye level, gentle hillside rice terraces in the foreground, forested limestone peaks beyond, realistic field edges and a small open path in the lower center, cloudy soft daylight, accurate natural greens, true photographic texture, no people, no text, no watermark, no fantasy."
  },
  "rice-path": {
    title: "Path through rice terraces",
    author: "Ahmet Yüksek / Pexels",
    url: "https://images.pexels.com/photos/36972555/pexels-photo-36972555.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic documentary photograph of a winding footpath between rice terraces in rural Vietnam, vertical 4:5 composition, camera at standing eye height, path entering from the lower center foreground, fields on both sides, wooded mountains and open sky in the distance, natural daylight, realistic earth texture, believable human-scale perspective and shadows, no people, no text, no logos, no watermark."
  },
  "mountain-lake": {
    title: "Mountain lake",
    author: "Quang Nguyen Vinh / Pexels",
    url: "https://images.pexels.com/photos/14023494/pexels-photo-14023494.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic editorial travel photograph of a calm emerald mountain lake in northern Vietnam, vertical 4:5 composition from a natural rocky lakeside viewpoint, a broad believable flat rock or shore area across the lower foreground where one standing visitor can be placed, limestone mountains and green islands across the water, soft bright daylight, natural reflections, true camera texture, no people, no boats, no signs, no text, no watermark."
  },
  "mist-lake": {
    title: "Misty mountain lake",
    author: "Linh Tran / Pexels",
    url: "https://images.pexels.com/photos/34847656/pexels-photo-34847656.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic cinematic travel photograph of a misty mountain lake in Vietnam at sunrise, vertical 4:5 portrait frame, quiet shoreline and a natural standing area in the lower foreground, mist drifting through layered mountain slopes, soft diffused sunrise light, realistic water and atmospheric perspective, subtle colors, no people, no text, no graphics, no watermark."
  },
  "waterfall": {
    title: "Forest waterfall",
    author: "Pexels",
    url: "https://images.pexels.com/photos/35424576/pexels-photo-35424576.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic travel photograph of a waterfall in a lush Vietnamese forest, vertical 4:5 composition, waterfall in the middle distance with mossy boulders and a clear dry rock ledge in the lower foreground for a visitor to stand on, soft natural forest daylight, realistic water motion, true photographic colors, no people, no text, no signs, no watermark."
  },
  "forest-stream": {
    title: "Forest stream",
    author: "Ella Ragasa / Pexels",
    url: "https://images.pexels.com/photos/30873702/pexels-photo-30873702.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic editorial photograph of a clear stream winding through a dense green Vietnamese forest, vertical 4:5 frame, foreground mossy rocks and a small dry bank at the lower center suitable for a standing person, lush trees and soft filtered daylight, realistic natural textures, neutral camera color, no people, no wildlife, no text, no watermark."
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

async function photoFallback(background) {
  const response = await fetch(background.url, {
    headers: { "user-agent": "DauAnAoXanh-Checkin/3.0" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    try { await response.body?.cancel(); } catch (_) {}
    throw new Error("Không tải được phông nền đã chọn.");
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      "content-type": response.headers.get("content-type") || "image/jpeg",
      "cache-control": "no-store, private, max-age=0",
      "x-content-type-options": "nosniff",
      "x-background-source": "photo-fallback",
      "x-background-attribution": background.author,
      "x-background-title": background.title,
      "content-disposition": "inline; filename=\"dau-an-ao-xanh-background.jpg\""
    }
  });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ message: "Yêu cầu không hợp lệ từ nguồn bên ngoài." }, 403);
  }
  if (rateLimited(request)) {
    return json({ message: "Bạn vừa tạo nhiều ảnh liên tiếp. Vui lòng đợi một phút rồi thử lại." }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ message: "Không đọc được yêu cầu chọn phông nền." }, 400);
  }
  const scene = body && typeof body.scene === "string" && BACKGROUNDS[body.scene] ? body.scene : "rice-gold";
  const selected = BACKGROUNDS[scene];

  // Try a true text-to-image background first when the free model is available.
  // The source photo remains on the device; only a scene description is sent.
  if (env.AI && typeof env.AI.run === "function") {
    try {
      const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
        prompt: selected.prompt,
        steps: 4,
        seed: Math.floor(Math.random() * 2147483647)
      });
      if (result && typeof result.image === "string" && result.image) {
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
            "x-background-attribution": "",
            "x-background-title": selected.title,
            "content-disposition": "inline; filename=\"dau-an-ao-xanh-ai-background.jpg\""
          }
        });
      }
      throw new Error("Workers AI returned no image payload.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error || "Unknown Workers AI error");
      console.error("Workers AI background generation failed:", detail.slice(0, 500));
    }
  }

  try {
    return await photoFallback(selected);
  } catch (error) {
    console.error("Selected photo background failed:", error instanceof Error ? error.message : String(error));
    return json({ message: "Không tải được phông nền đã chọn. Vui lòng chọn bối cảnh khác hoặc thử lại." }, 503);
  }
}