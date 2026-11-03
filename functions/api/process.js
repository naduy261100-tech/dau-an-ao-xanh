const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 4;

// Best-effort isolate-local limiter. Add a Cloudflare WAF rate-limit rule for /api/process in production.
const requestCounts = new Map();

const SCENES = {
  bright: {
    name: "Ruộng lúa Tuyên Quang",
    imageUrl: "https://images.pexels.com/photos/29127885/pexels-photo-29127885.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: [
      "Generate a photorealistic outdoor portrait environment inspired by the real green rice fields and mountain landscape of Tuyen Quang, northern Vietnam.",
      "Use natural layered rice terraces, forested mountain ridges, a believable open grassy or earth foreground, realistic distance and atmospheric perspective.",
      "Place the existing photographed person naturally in the scene, with the feet grounded on the same believable surface and the horizon at a plausible camera height.",
      "Match the source image camera perspective, subject scale, depth of field, light direction and color temperature.",
      "Preserve the photographed person as faithfully as possible: do not redraw, beautify, retouch, age, de-age, reshape or change facial identity, facial expression, skin tone, hair, clothing, accessories, body proportions or pose.",
      "Generate only the new environment around the existing cut-out person. Do not add people, limbs, objects touching the person, text, logos, signs or watermarks.",
      "Professional documentary travel photography, natural restrained colors, real-world textures, subtle contrast, no fantasy, no oversaturation, no artificial HDR."
    ].join(" ")
  },
  soft: {
    name: "Hồ núi Tuyên Quang",
    imageUrl: "https://images.pexels.com/photos/2166695/pexels-photo-2166695.jpeg?auto=compress&cs=tinysrgb&w=1800",
    prompt: [
      "Generate a photorealistic outdoor portrait environment inspired by the real misty mountain lake landscape of Tuyen Quang, northern Vietnam.",
      "Use forest-covered limestone mountains, calm water in the middle distance, soft morning mist and a natural open shoreline or clearing in the foreground.",
      "Create a plausible ground plane beneath the existing person's feet so the person does not look suspended or pasted on.",
      "Match the original camera height, perspective, subject scale, depth, lighting direction and color temperature; use soft natural daylight that fits the source portrait.",
      "Preserve the photographed person as faithfully as possible: do not redraw, beautify, retouch, age, de-age, reshape or change facial identity, facial expression, skin tone, hair, clothing, accessories, body proportions or pose.",
      "Generate only the new environment around the existing cut-out person. Do not add other people, extra limbs, objects touching the person, text, logos, signs or watermarks.",
      "Professional documentary travel photography, realistic foliage and water, subtle atmospheric depth, natural colors, no fantasy, no oversaturation, no artificial HDR."
    ].join(" ")
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff"
    }
  });
}

function validSignature(bytes, type) {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

function rateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const current = requestCounts.get(ip);

  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestCounts.set(ip, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  if (requestCounts.size > 1000) {
    for (const [key, value] of requestCounts) {
      if (now - value.startedAt >= WINDOW_MS) requestCounts.delete(key);
    }
  }
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function activeMode(env) {
  if (env.SCHOOL_PROCESSING_APPROVED === "YES") return "school";
  if (env.ADULT_TESTING_ENABLED === "YES") return "adult";
  return "locked";
}

export async function onRequestPost({ request, env }) {
  const ownOrigin = new URL(request.url).origin;
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin && requestOrigin !== ownOrigin) {
    return json({ message: "Yêu cầu không hợp lệ từ nguồn bên ngoài." }, 403);
  }

  const mode = activeMode(env);
  if (!env.PHOTOROOM_API_KEY || env.PHOTOROOM_NO_TRAINING_CONFIRMED !== "YES" || mode === "locked" || !env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY) {
    return json({ message: "Dịch vụ AI đang khóa. Quản trị viên cần hoàn tất cấu hình API và phê duyệt quyền riêng tư trước khi sử dụng." }, 503);
  }

  if (rateLimited(request)) {
    return json({ message: "Bạn đã chụp nhiều lần trong thời gian ngắn. Vui lòng đợi vài phút rồi thử lại." }, 429);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return json({ message: "Ảnh quá lớn. Vui lòng chụp lại." }, 413);
  }

  let form;
  try {
    form = await request.formData();
  } catch (_) {
    return json({ message: "Không đọc được ảnh. Vui lòng chụp lại." }, 400);
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || !photo.size) {
    return json({ message: "Chưa nhận được ảnh chụp." }, 400);
  }
  if (photo.size > MAX_IMAGE_BYTES) {
    return json({ message: "Ảnh quá lớn. Vui lòng chụp lại." }, 413);
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
    return json({ message: "Định dạng ảnh chưa được hỗ trợ. Vui lòng dùng JPG, PNG hoặc WebP." }, 415);
  }

  const consent = form.get("consent");
  if (mode === "adult" && consent !== "adult") {
    return json({ message: "Giai đoạn thử nghiệm chỉ tiếp nhận ảnh của chính người trưởng thành đã đồng ý." }, 400);
  }
  if (mode === "school" && consent !== "school") {
    return json({ message: "Vui lòng xác nhận đã đọc thông báo xử lý ảnh và có quyền đồng ý." }, 400);
  }

  const signature = new Uint8Array(await photo.slice(0, 12).arrayBuffer());
  if (!validSignature(signature, photo.type)) {
    return json({ message: "Tệp gửi lên không phải ảnh hợp lệ." }, 415);
  }

  const turnstileToken = form.get("cf-turnstile-response");
  if (typeof turnstileToken !== "string" || !turnstileToken) {
    return json({ message: "Không xác thực được lượt chụp. Vui lòng thử lại." }, 403);
  }

  const verifyBody = new FormData();
  verifyBody.set("secret", env.TURNSTILE_SECRET_KEY);
  verifyBody.set("response", turnstileToken);
  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) verifyBody.set("remoteip", remoteIp);

  let verification;
  try {
    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: verifyBody,
      signal: AbortSignal.timeout(10000)
    });
    verification = await verifyResponse.json();
  } catch (_) {
    return json({ message: "Không xác thực được lượt chụp. Vui lòng thử lại." }, 502);
  }

  const expectedHost = new URL(request.url).hostname;
  if (!verification?.success || verification.hostname !== expectedHost) {
    return json({ message: "Xác thực bảo mật không thành công. Vui lòng tải lại trang và thử lại." }, 403);
  }

  const profile = form.get("photoProfile");
  const scene = profile === "bright" ? SCENES.bright : SCENES.soft;

  const apiForm = new FormData();
  apiForm.append("imageFile", photo, "dau-an-ao-xanh.jpg");
  apiForm.set("removeBackground", "true");
  apiForm.set("referenceBox", "originalImage");
  apiForm.set("background.prompt", scene.prompt);
  apiForm.set("background.guidance.imageUrl", scene.imageUrl);
  apiForm.set("background.guidance.scale", "0.72");
  apiForm.set("lighting.mode", "ai.preserve-hue-and-saturation");
  apiForm.set("padding", "0.04");
  apiForm.set("maxWidth", "1800");
  apiForm.set("maxHeight", "2400");
  apiForm.set("export.format", "jpeg");

  let aiResponse;
  try {
    aiResponse = await fetch("https://image-api.photoroom.com/v2/edit", {
      method: "POST",
      headers: {
        "x-api-key": env.PHOTOROOM_API_KEY,
        "pr-ai-background-model-version": env.PHOTOROOM_MODEL_VERSION || "background-studio-beta-2025-03-17",
        "Accept": "image/jpeg, image/png, image/webp"
      },
      body: apiForm,
      signal: AbortSignal.timeout(90000)
    });
  } catch (_) {
    return json({ message: "Không kết nối được dịch vụ AI. Vui lòng kiểm tra Internet và thử lại." }, 502);
  }

  if (!aiResponse.ok) {
    const providerStatus = aiResponse.status;
    try { await aiResponse.body?.cancel(); } catch (_) {}
    if (providerStatus === 401 || providerStatus === 403) {
      return json({ message: "Khóa API hoặc quyền sử dụng PhotoRoom chưa hợp lệ." }, 502);
    }
    if (providerStatus === 402) {
      return json({ message: "Tài khoản PhotoRoom đã hết lượt hoặc chưa có gói Image Editing API Plus." }, 402);
    }
    if (providerStatus === 429) {
      return json({ message: "Dịch vụ AI đang bận. Vui lòng đợi một chút rồi thử lại." }, 429);
    }
    return json({ message: "AI chưa xử lý được ảnh này. Hãy chụp rõ toàn thân, đủ sáng và tránh để người bị che khuất." }, 502);
  }

  const resultType = aiResponse.headers.get("content-type") || "image/jpeg";
  if (!resultType.startsWith("image/")) {
    try { await aiResponse.body?.cancel(); } catch (_) {}
    return json({ message: "Dịch vụ AI trả về kết quả không hợp lệ." }, 502);
  }

  // API đồng bộ trả ảnh trực tiếp; không ghi ảnh vào ổ đĩa, database, KV hay R2.
  return new Response(aiResponse.body, {
    status: 200,
    headers: {
      "content-type": resultType,
      "cache-control": "no-store, private, max-age=0",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline; filename=\"dau-an-ao-xanh.jpg\""
    }
  });
}
