const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestCounts = new Map();
const backgroundGenerationPromises = new Map();
const DAILY_VARIANTS_PER_SCENE = 4;
const DAILY_POOL_TTL_SECONDS = 48 * 60 * 60;

const BACKGROUNDS = {
  "rice-gold": {
    title: "Golden terraced rice fields",
    author: "Quang Nguyen Vinh / Pexels",
    url: "https://images.pexels.com/photos/14025282/pexels-photo-14025282.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic travel portrait background of golden terraced rice fields in northern Vietnam. Ground-level human-eye camera, vertical 4:5 composition. A clearly visible dry earthen footpath or broad terrace edge crosses the lower foreground and forms a safe standing place, with golden fields and mountains behind. Natural late afternoon daylight, believable perspective and textures. No people, no text, no logo, no watermark, no illustration."
  },
  "rice-green": {
    title: "Green terraced valley with a walking path",
    author: "Duc Nguyen / Pexels",
    url: "https://images.pexels.com/photos/35872968/pexels-photo-35872968.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic ground-level travel photograph of a lush green terraced valley in northern Vietnam. The lower foreground must clearly show a dry farm path or solid terrace walkway wide enough for one visitor to stand. Green rice fields and forested limestone mountains in the distance, soft daylight, natural colors, realistic camera perspective. No people, no text, no watermark."
  },
  "rice-path": {
    title: "Winding path through rice terraces",
    author: "Ahmet Yüksek / Pexels",
    url: "https://images.pexels.com/photos/36972555/pexels-photo-36972555.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic documentary travel photograph of a dry winding footpath between rice terraces in rural northern Vietnam. The path begins at the lower edge and stays clearly visible across the foreground as the natural place to stand; do not use rice paddies as the standing surface. Human-eye viewpoint, fields on both sides, wooded mountains in the distance, natural daylight. No people, text, logo or watermark."
  },
  "village-stone": {
    title: "Stone path in a mountain village",
    author: "Beyza Kaplan / Pexels",
    url: "https://images.pexels.com/photos/13990021/pexels-photo-13990021.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic travel photograph of a northern Vietnamese mountain village. A broad, dry, stone-paved footpath is clearly visible in the lower foreground and leads toward traditional village houses and green mountains. Ground-level standing viewpoint, natural daylight, realistic stone texture and human-scale perspective. No people, no signs, no text, no watermark."
  },
  "village-road": {
    title: "Mountain village road",
    author: "Thanh Luu / Pexels",
    url: "https://images.pexels.com/photos/18707791/pexels-photo-18707791.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic travel photograph of a quiet mountain village in Vietnam. Show a clearly visible dry village road or paved lane in the lower foreground, wide and level enough for a person to stand safely, with houses, blossoming trees and misty green mountains behind. Ground-level natural camera perspective, authentic daylight and colors. No people, no vehicles, no text, no watermark."
  },
  "hill-path": {
    title: "Winding trail across green hills",
    author: "Tường Chopper / Pexels",
    url: "https://images.pexels.com/photos/33753208/pexels-photo-33753208.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic travel photograph of rolling green hills in Vietnam. A winding, dry, walkable dirt or gravel trail is clearly visible across the lower foreground and is the only place intended for a standing visitor. Ground-level human-eye view, green slopes and distant sky, realistic scale, soft natural daylight. No person, no text, no watermark, no aerial viewpoint."
  },
  "wood-bridge": {
    title: "Wooden footbridge in a green forest",
    author: "Quang Nguyen Vinh / Pexels",
    url: "https://images.pexels.com/photos/15610727/pexels-photo-15610727.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic forest travel photograph with a sturdy wooden footbridge crossing a small stream. The wooden plank deck must be broad, dry and clearly visible in the lower foreground, leading into lush trees; this bridge deck is the safe standing surface. Camera at human standing height, realistic perspective and soft filtered daylight. The stream is only below and beside the bridge, never the standing surface. No people, text or watermark."
  },
  "garden-walk": {
    title: "Walkway in a lush garden",
    author: "nhavantuonglai / Pexels",
    url: "https://images.pexels.com/photos/40540628/pexels-photo-40540628.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic travel portrait background of a lush Vietnamese garden. A continuous stone or paved garden walkway must be prominent in the lower foreground, wide enough for a visitor to stand with both feet on it. Dense greenery and flowers frame the walkway. Ground-level eye-height camera, natural daylight, realistic depth and colors. No people, no text, no watermark."
  },
  "traditional-garden": {
    title: "Traditional wooden house garden",
    author: "juliber Tran / Pexels",
    url: "https://images.pexels.com/photos/36964081/pexels-photo-36964081.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic travel photograph of a traditional Vietnamese wooden house set in a peaceful garden. Clearly show a solid stone courtyard or stone pathway in the lower foreground where a visitor can naturally stand, with the wooden house and green plants behind. Ground-level human-eye viewpoint, authentic wood and stone textures, soft natural daylight. No people, no text, no watermark."
  },
  "flower-garden": {
    title: "Flower garden with a paved walkway",
    author: "Nguyễn Tiến Thịnh / Pexels",
    url: "https://images.pexels.com/photos/35457218/pexels-photo-35457218.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic outdoor travel photograph of a colorful flower garden in Vietnam. A clearly visible dry paved or stone walkway runs through the lower foreground between flower beds, with enough open width for one visitor to stand. Keep the path continuous beneath the intended standing position. Human-eye camera angle, soft daylight, realistic colors and depth. No people, no text, no watermark."
  },
  "waterfall": {
    title: "Forest waterfall with dry stone viewing area",
    author: "Pexels",
    url: "https://images.pexels.com/photos/35424576/pexels-photo-35424576.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: "Photorealistic travel photograph of a waterfall in a lush Vietnamese forest. A broad, stable, dry stone viewing platform or flat rock clearing is clearly visible in the lower foreground, separated from the running water, as the safe place to stand. Mossy boulders and waterfall in the middle distance, natural forest daylight, realistic water and camera perspective. No people, text, signs or watermark."
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
    return json({ message: "Có nhiều lượt tạo ảnh cùng lúc. Vui lòng đợi một phút rồi thử lại." }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ message: "Không đọc được yêu cầu chọn phông nền." }, 400);
  }

  const sceneId = body && typeof body.scene === "string" && BACKGROUNDS[body.scene] ? body.scene : "rice-gold";
  const selected = BACKGROUNDS[sceneId];
  const mode = body?.mode === "library" ? "library" : "ai-background";

  // Use a fixed photo only when the user explicitly chooses the library mode.
  if (mode === "library") {
    try {
      return await photoFallback(selected);
    } catch (error) {
      console.error("Selected photo background failed:", error instanceof Error ? error.message : String(error));
      return json({ message: "Không tải được ảnh nền thư viện. Vui lòng thử lại." }, 503);
    }
  }

  // Only a scene ID and text prompt are sent to Workers AI.
  // The user's photograph never leaves the browser in this mode.
  if (!env.AI || typeof env.AI.run !== "function") {
    return json({ message: "Dịch vụ tạo phông nền AI chưa sẵn sàng. Ảnh người vẫn an toàn trên điện thoại; vui lòng thử lại sau." }, 503);
  }

  const parsedSeed = Number(body?.seed);
  const seed = Number.isSafeInteger(parsedSeed) && parsedSeed > 0
    ? parsedSeed
    : Math.floor(Math.random() * 2147483646) + 1;
  const lightBrightness = Number.isFinite(Number(body?.light?.brightness))
    ? Math.max(0.12, Math.min(0.92, Number(body.light.brightness)))
    : 0.52;
  const lightWarmth = Number.isFinite(Number(body?.light?.warmth))
    ? Math.max(-0.25, Math.min(0.25, Number(body.light.warmth)))
    : 0;
  const exposureMatch = lightBrightness > 0.68
    ? "The source subject is brightly exposed; keep the background open and bright with soft highlight roll-off, never dark or dramatic."
    : lightBrightness < 0.34
      ? "The source subject is in softer/lower light; use gentle open shade and moderate background exposure, avoid harsh direct sunlight."
      : "The source subject has balanced midtone exposure; use even natural daylight and realistic midtone contrast.";
  const whiteBalanceMatch = lightWarmth > 0.055
    ? "Use a subtly warm-neutral daylight white balance compatible with warm skin and clothing; do not turn the entire scene orange."
    : lightWarmth < -0.045
      ? "Use a slightly cool-neutral daylight white balance compatible with a cool-lit subject; keep skin-friendly greens and neutral highlights."
      : "Use neutral daylight white balance with restrained true-to-life greens and whites.";
  const lighting = "Use soft broad natural daylight, plausible shadow direction and realistic exposure. " + exposureMatch + " " + whiteBalanceMatch;
  const framing = body?.framing === "portrait" ? "portrait" : "full-body";
  const compositionPrompt = framing === "portrait"
    ? "Compose as a premium environmental travel portrait background for a close-up or waist-up subject. Keep scenic mountains, village details and natural depth behind the center of frame. The subject will have no visible feet, so do not invent a standing person or a forced empty platform. Use a natural eye-level camera perspective and leave uncluttered visual space behind the face."
    : "CRITICAL COMPOSITION: the lower 30 percent must contain a broad, continuous, clearly visible, dry, level standing surface matching the scene (path, paved lane, stone courtyard, bridge deck or dry viewing platform). The surface must extend to the bottom edge and have enough open area for one full-length person to be composited later. Keep the horizon and main scenery in the upper half. Leave an uncluttered central foreground standing area. Show realistic ground texture and a natural light direction. No steep aerial or drone viewpoint.";
  const prompt = [
    selected.prompt,
    "Create a completely new original landscape photograph for this request, not a copy of a stock photo.",
    "Premium high-detail professional real-camera travel photography, crisp natural textures and fine detail, vertical portrait composition, full-frame camera, natural 35mm lens, camera at a standing person's eye level, believable human-scale perspective, realistic dynamic range, clean sharp focus, physically plausible natural light.",
    compositionPrompt,
    lighting,
    "Keep greens and other colors naturally saturated, with realistic highlight roll-off, restrained local contrast and camera-like dynamic range; avoid excessive HDR, neon colors or artificial sharpness.",
    "Do not include any people, human silhouettes, faces, statues, mannequins, animals, signs, letters, captions, logos, borders or watermarks. Water is background scenery only and must never occupy the standing area.",
    "Photographic truth is mandatory: it must look like an unretouched real travel photograph captured on location by a professional documentary photographer, not an illustration, not concept art, not an architectural visualization, not a 3D render, not a painting, not plastic-looking AI art. Use realistic imperfect natural details, plausible optics, fine real-world textures, natural contrast and restrained saturation."
  ].join(" ");

  // Daily AI pool: 11 scene families x 4 generated variants = 44
  // unique backgrounds/day. The 44 images are reused across approximately
  // 100 on-device person composites, keeping daily inference under 10,000
  // free Neurons while retaining 1024x1280 background quality.
  if (!env.BG_CACHE || typeof env.BG_CACHE.get !== "function" || typeof env.BG_CACHE.put !== "function") {
    return json({
      message: "Kho phông nền AI chưa được kết nối. Ảnh người vẫn an toàn trên thiết bị; vui lòng chọn nền thư viện tạm thời.",
      errorCode: "AI_BACKGROUND_CACHE_NOT_CONFIGURED"
    }, 503);
  }

  const utcDay = new Date().toISOString().slice(0, 10);
  const variant = seed % DAILY_VARIANTS_PER_SCENE;
  const cacheKey = `ai-bg-pool-v1:${utcDay}:${sceneId}:${variant}`;

  const makeResponse = (bytes, cacheStatus) => new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "no-store, private, max-age=0",
      "x-content-type-options": "nosniff",
      "x-background-source": "flux-ai",
      "x-background-cache": cacheStatus,
      "x-background-pool-size": String(Object.keys(BACKGROUNDS).length * DAILY_VARIANTS_PER_SCENE),
      "x-background-pool-variant": String(variant + 1),
      "x-background-attribution": "",
      "x-background-title": selected.title,
      "x-background-seed": String(seed),
      "x-background-model": "FLUX.2-Klein-4B",
      "content-disposition": "inline; filename=\"dau-an-ao-xanh-ai-background.jpg\""
    }
  });

  try {
    const cached = await env.BG_CACHE.get(cacheKey, "arrayBuffer");
    if (cached) return makeResponse(cached, "hit");
  } catch (error) {
    console.error("AI background pool cache read failed:", error instanceof Error ? error.message : String(error));
    return json({
      message: "Không đọc được kho phông nền AI trong ngày. Để bảo vệ hạn mức miễn phí, ứng dụng tạm dừng tạo nền mới; vui lòng chọn nền thư viện.",
      errorCode: "AI_BACKGROUND_CACHE_READ_FAILED"
    }, 503);
  }

  let generation = backgroundGenerationPromises.get(cacheKey);
  if (!generation) {
    generation = (async () => {
      if (!env.AI || typeof env.AI.run !== "function") {
        throw new Error("AI binding is not available");
      }
      const form = new FormData();
      form.set("prompt", prompt);
      form.set("width", "1024");
      form.set("height", "1280");
      form.set("seed", String(seed));
      const serialized = new Response(form);
      const result = await env.AI.run("@cf/black-forest-labs/flux-2-klein-4b", {
        multipart: {
          body: serialized.body,
          contentType: serialized.headers.get("content-type")
        }
      });
      if (!result || typeof result.image !== "string" || !result.image) {
        throw new Error("model-returned-no-image");
      }
      const binary = atob(result.image);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      if (bytes.length < 10000) throw new Error("model-image-too-small");

      // Save the landscape before returning it so the next visitor reuses it.
      await env.BG_CACHE.put(cacheKey, bytes, {
        expirationTtl: DAILY_POOL_TTL_SECONDS
      });
      return bytes;
    })();
    backgroundGenerationPromises.set(cacheKey, generation);
  }

  try {
    const bytes = await generation;
    return makeResponse(bytes, "generated");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || "unknown-error");
    const normalized = detail.toLowerCase();
    console.error("AI background pool generation failed:", detail.slice(0, 500));
    const dailyQuotaExhausted =
      normalized.includes("4006") ||
      normalized.includes("daily free allocation") ||
      normalized.includes("10,000 neurons");
    if (dailyQuotaExhausted) {
      return json({
        message: "Đã hết hạn mức AI miễn phí hôm nay của tài khoản Cloudflare (10.000 Neurons/ngày). Đây không phải lỗi ảnh chụp hay kết nối Internet. Hạn mức tự làm mới lúc 07:00 sáng giờ Việt Nam mỗi ngày. Trong lúc chờ, bạn có thể chọn “Dùng nền thư viện có sẵn” hoặc thử tạo nền AI lại sau giờ làm mới.",
        errorCode: "AI_DAILY_QUOTA_EXHAUSTED",
        retryAt: "00:00 UTC"
      }, 429);
    }
    if (normalized.includes("kv") || normalized.includes("storage")) {
      return json({
        message: "AI đã không thể lưu phông nền vào kho dùng chung. Để tránh tiêu hao thêm hạn mức miễn phí, ứng dụng tạm dừng tạo nền mới; vui lòng dùng nền thư viện hoặc thử lại sau.",
        errorCode: "AI_BACKGROUND_POOL_STORE_FAILED"
      }, 503);
    }
    return json({
      message: "Dịch vụ tạo phông nền AI đang gặp lỗi từ mô hình. Vui lòng thử lại sau hoặc chọn “Dùng nền thư viện có sẵn”. Ảnh người vẫn chưa được gửi lên AI.",
      errorCode: "AI_BACKGROUND_GENERATION_FAILED",
      providerDetail: detail.slice(0, 160)
    }, 503);
  } finally {
    if (backgroundGenerationPromises.get(cacheKey) === generation) {
      backgroundGenerationPromises.delete(cacheKey);
    }
  }
}
