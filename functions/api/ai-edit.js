const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 8;
const requestCounts = new Map();
const MODEL = "black-forest-labs/flux-1-kontext-pro";
const MAX_IMAGE_BASE64_LENGTH = 7_500_000;

const SCENE_PROMPTS = {
  "rice-gold": "a real northern Vietnam mountain valley with golden terraced rice fields in harvest season, layered rice terraces stepping along green mountains, a natural earth terrace path and believable ground plane, soft late-afternoon daylight",
  "rice-green": "a real lush green terraced rice valley in northern Vietnam, layered rice paddies following the hillsides, forested limestone mountain peaks, soft cloudy daylight and natural green tones",
  "rice-path": "a real winding footpath through northern Vietnam rice terraces, a narrow earthy path in the foreground with green fields on both sides and distant forested mountains, natural daytime light",
  "mountain-lake": "a real emerald mountain lake in northern Vietnam, calm water, forested limestone mountains and islands, natural rocky shore in the foreground, bright but soft daylight",
  "mist-lake": "a real forest mountain lake in northern Vietnam, lush green forest surrounding calm water, layered mountain slopes with light morning mist and diffused sunrise light",
  "waterfall": "a real waterfall in a lush northern Vietnam forest, mossy boulders, a natural dry rocky standing area in the foreground, soft forest daylight and realistic water",
  "forest-stream": "a real clear stream winding through a dense green northern Vietnam forest, mossy rocks and a natural dry bank in the foreground, soft filtered daylight"
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
    if (!bytes.length || bytes.length > 15_000_000) throw new Error("invalid-output-size");
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
    return json({ message: "Dịch vụ AI chỉnh sửa ảnh chưa được kết nối trên máy chủ." }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8_000_000) {
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
  const promptScene = typeof body.scene === "string" ? SCENE_PROMPTS[body.scene] : null;
  if (!promptScene) return json({ message: "Phông nền đã chọn không hợp lệ." }, 400);

  const mimeType = body.mimeType;
  const imageBase64 = body.imageBase64;
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType) ||
      typeof imageBase64 !== "string" ||
      imageBase64.length < 1000 ||
      imageBase64.length > MAX_IMAGE_BASE64_LENGTH ||
      !/^[A-Za-z0-9+/]+=*$/.test(imageBase64)) {
    return json({ message: "Ảnh không đúng định dạng hoặc vượt giới hạn dung lượng." }, 400);
  }

  const prompt = [
    "Edit the supplied photograph into a highly photorealistic environmental portrait.",
    "The input photograph contains the real person who must remain the same person.",
    "Preserve that person's recognizable identity, face, facial proportions, expression, age, skin tone, hairstyle, clothing, body shape, pose, hands and all visible personal details as faithfully as possible.",
    "Do not replace the person, invent another person, beautify or stylize their face, change their clothes, or add extra people.",
    "Replace and reconstruct the surrounding background as this real location: " + promptScene + ".",
    "Make the person look naturally photographed at this location, not pasted or cut out. Match camera perspective, subject scale, horizon, focal length, depth of field, ambient illumination, color temperature, directional light, contact shadows and ground contact. Light and shadows must be physically coherent between the person and environment.",
    "Use realistic documentary travel photography, natural skin texture, true camera detail, believable perspective, and natural colors. No illustration, no fantasy, no text, no logo, no watermark.",
    "Keep the portrait composition vertical and retain the full visible person from the source wherever possible."
  ].join(" ");

  try {
    const result = await env.AI.run(MODEL, {
      prompt,
      input_image: imageBase64,
      aspect_ratio: "4:5",
      output_format: "jpeg",
      safety_tolerance: 2,
      seed: Math.floor(Math.random() * 2147483647)
    });
    const output = await getEditedImage(result);
    return new Response(output.bytes, {
      status: 200,
      headers: {
        "content-type": output.contentType,
        "cache-control": "no-store, private, max-age=0",
        "x-content-type-options": "nosniff",
        "x-image-edit-model": "FLUX.1-Kontext-Pro",
        "content-disposition": "inline; filename=\"dau-an-ao-xanh-ai.jpg\""
      }
    });
  } catch (error) {
    console.error("AI image edit failed:", error instanceof Error ? error.message.slice(0, 180) : "unknown-error");
    return json({
      message: "Mô hình AI chỉnh sửa ảnh hiện chưa xử lý được yêu cầu. Có thể dịch vụ hoặc thanh toán AI chưa sẵn sàng. Ảnh chưa được chuyển sang chế độ ghép 2D; hãy thử lại sau hoặc chọn chế độ riêng tư."
    }, 503);
  }
}
