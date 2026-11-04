const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 25;
const requestCounts = new Map();
const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const MAX_IMAGE_BASE64_LENGTH = 1_500_000;

const BACKGROUNDS = {
  "rice-gold": { title: "ruộng bậc thang lúa chín vàng", standingSurface: "a dry earthen footpath or broad terrace edge visible in the lower foreground", url: "https://images.pexels.com/photos/14025282/pexels-photo-14025282.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" },
  "rice-green": { title: "thung lũng ruộng bậc thang xanh", standingSurface: "a dry farm path or solid terrace walkway in the foreground, not the rice paddy", url: "https://images.pexels.com/photos/35872968/pexels-photo-35872968.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" },
  "rice-path": { title: "con đường nhỏ giữa ruộng bậc thang", standingSurface: "the clearly visible dry winding footpath through the fields", url: "https://images.pexels.com/photos/36972555/pexels-photo-36972555.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" },
  "village-stone": { title: "đường đá trong bản làng miền núi", standingSurface: "the broad, dry, stone-paved village footpath", url: "https://images.pexels.com/photos/13990021/pexels-photo-13990021.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" },
  "village-road": { title: "con đường khô ráo trong bản làng miền núi", standingSurface: "the visible, level village road in the lower foreground", url: "https://images.pexels.com/photos/18707791/pexels-photo-18707791.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" },
  "hill-path": { title: "lối mòn uốn quanh đồi xanh", standingSurface: "the dry dirt or gravel trail visible across the foreground", url: "https://images.pexels.com/photos/33753208/pexels-photo-33753208.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" },
  "wood-bridge": { title: "cầu gỗ giữa khu rừng xanh", standingSurface: "the solid wooden plank deck of the footbridge, with both feet on the planks and water only below the bridge", url: "https://images.pexels.com/photos/15610727/pexels-photo-15610727.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" },
  "garden-walk": { title: "lối đi lát đá trong khu vườn xanh", standingSurface: "the continuous paved or stone garden walkway in the lower foreground", url: "https://images.pexels.com/photos/40540628/pexels-photo-40540628.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" },
  "traditional-garden": { title: "sân vườn và lối đá trước ngôi nhà gỗ truyền thống", standingSurface: "the solid stone courtyard or stone pathway in front of the wooden house", url: "https://images.pexels.com/photos/36964081/pexels-photo-36964081.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" },
  "flower-garden": { title: "vườn hoa nhiều màu với lối đi lát đá", standingSurface: "the dry paved or stone walkway that runs between the flower beds", url: "https://images.pexels.com/photos/35457218/pexels-photo-35457218.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" },
  "waterfall": { title: "thác nước giữa rừng với bãi đá khô", standingSurface: "a broad, stable, dry stone viewing platform in the lower foreground, well away from the running water", url: "https://images.pexels.com/photos/35424576/pexels-photo-35424576.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop" }
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
      "Image 0 is the selected real landscape photograph. Use it as the actual place and preserve its recognizable scenery, terrain, vegetation, architecture, colors and photographic character.",
      "Image 1 contains the exact real person. Remove the original background around this person and place this same person naturally into image 0.",
      "CRITICAL PHYSICAL PLACEMENT: the person must stand on " + scene.standingSurface + ". The walking surface must visibly continue underneath both feet. Show both shoes or feet making believable contact with the ground or floor whenever they are visible in the source photo.",
      "NEVER put the person on the surface of a lake, river, pond, stream or waterfall; never make them float, hover, stand on crops, flower beds, water, empty air, a roof or the edge of a cliff. Water is scenery only, never a floor.",
      "If the reference photo does not provide enough clear standing room, naturally extend or create a small, physically plausible continuation of the same path, bridge deck, courtyard or dry stone platform in the lower foreground. It must connect seamlessly to the existing terrain and match the scene; do not invent a floating platform.",
      "The person's identity is the highest priority. Preserve the same recognizable face, facial proportions, eyes, nose, mouth, skin tone, age, hairstyle, expression, glasses if present, clothing, body shape, pose and personal details. Do not invent another person or redesign their face.",
      "Match realistic human scale, ground-level camera viewpoint, horizon, perspective, depth of field, ambient light, color temperature, light direction and softness. Add subtle contact shadows directly under the shoes and natural shadowing consistent with the selected scene.",
      "Keep the person's pose and clothing unchanged. Keep hands and fingers natural. Do not add other people, signs, text, logos, frames or watermarks.",
      "The result must look like a normal high-quality real camera photograph taken at this location, not a pasted cutout, collage, illustration or fantasy scene.",
      "Use a vertical portrait composition. Keep as much of the person visible as the source photo allows. Do not crop off the feet when they are present in the source photo."
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
