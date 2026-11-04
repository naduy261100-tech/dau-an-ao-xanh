const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 25;
const requestCounts = new Map();
const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const MAX_IMAGE_BASE64_LENGTH = 1_500_000;

const BACKGROUNDS = {
  "rice-gold": {
    title: "ruộng bậc thang lúa chín vàng ở miền núi phía Bắc Việt Nam",
    url: "https://images.pexels.com/photos/14025282/pexels-photo-14025282.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop"
  },
  "rice-green": {
    title: "thung lũng ruộng bậc thang xanh với núi rừng phía xa",
    url: "https://images.pexels.com/photos/35872968/pexels-photo-35872968.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop"
  },
  "rice-path": {
    title: "lối nhỏ uốn quanh giữa những thửa ruộng bậc thang",
    url: "https://images.pexels.com/photos/36972555/pexels-photo-36972555.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop"
  },
  "mountain-lake": {
    title: "hồ nước xanh trong giữa núi đá và rừng cây",
    url: "https://images.pexels.com/photos/14023494/pexels-photo-14023494.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop"
  },
  "mist-lake": {
    title: "hồ núi giữa rừng xanh với không khí sương nhẹ",
    url: "https://images.pexels.com/photos/17924726/pexels-photo-17924726.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop"
  },
  "waterfall": {
    title: "thác nước tự nhiên giữa khu rừng nhiệt đới xanh mát",
    url: "https://images.pexels.com/photos/35424576/pexels-photo-35424576.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop"
  },
  "forest-stream": {
    title: "con suối trong len qua rừng cây và những tảng đá phủ rêu",
    url: "https://images.pexels.com/photos/30873702/pexels-photo-30873702.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop"
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

function isRateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = ip + "|" + (request.headers.get("User-Agent") || "unknown").slice(0, 120);
  const now = Date.now();
  const record = requestCounts.get(key);
  if (!record || now - record.startedAt >= WINDOW_MS) {
    requestCounts.set(key, { startedAt: now, count: 1 });
    return false;
  }
  record.count += 1;
  return record.count > MAX_REQUESTS_PER_WINDOW;
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getEditedImage(result) {
  const image = result?.image || result?.result?.image || result?.output?.image;
  if (typeof image !== "string" || !image) throw new Error("empty-image-result");

  if (image.startsWith("data:image/")) {
    const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (!match) throw new Error("invalid-data-image");
    return { bytes: decodeBase64(match[2]), contentType: match[1] };
  }
  if (/^https:\/\//i.test(image)) {
    const response = await fetch(image, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error("could-not-fetch-edited-image");
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) throw new Error("model-result-not-image");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 12_000_000) throw new Error("invalid-output-size");
    return { bytes, contentType };
  }
  if (/^[A-Za-z0-9+/]+=*$/.test(image) && image.length > 1000) {
    return { bytes: decodeBase64(image), contentType: "image/jpeg" };
  }
  throw new Error("unsupported-image-result");
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ message: "Yêu cầu không hợp lệ từ nguồn bên ngoài." }, 403);
  }
  if (isRateLimited(request)) {
    return json({ message: "Bạn vừa dùng chế độ AI nhiều lần. Vui lòng đợi một phút rồi thử lại." }, 429);
  }
  if (!env.AI || typeof env.AI.run !== "function") {
    return json({ message: "Dịch vụ AI miễn phí chưa được kết nối trên máy chủ." }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2_000_000) {
    return json({ message: "Ảnh gửi lên quá lớn. Vui lòng chụp lại." }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ message: "Không đọc được dữ liệu ảnh gửi tới AI." }, 400);
  }
  if (body?.consent !== true) {
    return json({ message: "Chưa có chấp thuận riêng cho việc gửi ảnh tới dịch vụ AI." }, 400);
  }

  const scene = typeof body.scene === "string" ? BACKGROUNDS[body.scene] : null;
  if (!scene) return json({ message: "Phông nền đã chọn không hợp lệ." }, 400);

  const imageBase64 = body.imageBase64;
  if (body.mimeType !== "image/jpeg" ||
      typeof imageBase64 !== "string" ||
      imageBase64.length < 1000 ||
      imageBase64.length > MAX_IMAGE_BASE64_LENGTH ||
      !/^[A-Za-z0-9+/]+=*$/.test(imageBase64)) {
    return json({ message: "Ảnh không đúng định dạng hoặc vượt giới hạn dung lượng." }, 400);
  }

  try {
    // The selected landscape is a reference image (image 0). The user's photo
    // is image 1. Both references are prepared below 512x512 as required by
    // FLUX.2 Klein multi-reference editing.
    const backgroundResponse = await fetch(scene.url, {
      headers: { "user-agent": "DauAnAoXanh-Checkin/4.0" },
      signal: AbortSignal.timeout(15000)
    });
    if (!backgroundResponse.ok || !backgroundResponse.headers.get("content-type")?.startsWith("image/")) {
      throw new Error("background-reference-unavailable");
    }
    const backgroundBlob = await backgroundResponse.blob();
    if (backgroundBlob.size > 500_000) throw new Error("background-reference-too-large");

    const personBytes = decodeBase64(imageBase64);
    const personBlob = new Blob([personBytes], { type: "image/jpeg" });
    const form = new FormData();
    form.append("input_image_0", backgroundBlob, "selected-landscape.jpg");
    form.append("input_image_1", personBlob, "person-photo.jpg");
    form.append("prompt", [
      "Create one highly photorealistic, natural travel portrait by editing and combining the two reference images.",
      "Image 0 is the selected real landscape photograph. Use it as the actual place and preserve its recognizable scenery, terrain, colors and photographic character.",
      "Image 1 contains the real person. Take this exact person from image 1 and place them naturally into image 0, standing on a believable foreground path, bank or safe flat ground area.",
      "The person's identity is the highest priority. Preserve the same recognizable face, facial proportions, eyes, nose, mouth, skin tone, age, hairstyle, expression, glasses if present, clothing, body shape, pose and personal details. Do not invent another person or beautify or redesign their face.",
      "Remove the original background around the person in image 1. Do not preserve its room, wall or scenery. Integrate the person into image 0 as if both were photographed together at the same moment.",
      "Match realistic human scale, camera viewpoint, horizon, perspective, depth of field, ambient light, color temperature, light direction and softness. Add only physically plausible foot contact and subtle ground shadows consistent with the selected landscape.",
      "Keep the person's pose and clothing unchanged. Keep hands and fingers natural. Do not add other people, signs, text, logos, frames or watermarks.",
      "The result must look like an ordinary high-quality real camera photograph, not a pasted cutout, collage, illustration or fantasy scene.",
      "Use a vertical portrait composition. Keep as much of the person visible as the source photo allows."
    ].join(" "));
    form.append("width", "768");
    form.append("height", "960");

    const serialized = new Response(form);
    const result = await env.AI.run(MODEL, {
      multipart: {
        body: serialized.body,
        contentType: serialized.headers.get("content-type")
      }
    });
    const output = await getEditedImage(result);
    return new Response(output.bytes, {
      status: 200,
      headers: {
        "content-type": output.contentType,
        "cache-control": "no-store, private, max-age=0",
        "x-content-type-options": "nosniff",
        "x-image-edit-model": "FLUX.2-Klein-4B",
        "x-ai-usage": "Workers-AI-daily-free-neuron-allocation",
        "content-disposition": "inline; filename=\"dau-an-ao-xanh-ai.jpg\""
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown-error";
    console.error("Free AI image edit failed:", detail.slice(0, 180));
    const message = detail.includes("background-reference-unavailable")
      ? "Không tải được ảnh phong cảnh mẫu. Vui lòng chọn bối cảnh khác hoặc thử lại."
      : "AI chỉnh ảnh miễn phí hiện đang bận hoặc đã hết hạn mức sử dụng trong ngày. Ứng dụng không tự chuyển sang dịch vụ trả phí. Bạn có thể thử lại sau hoặc chọn chế độ riêng tư trên điện thoại.";
    return json({
      message,
      errorCode: detail.slice(0, 180)
    }, 503);
  }
}
