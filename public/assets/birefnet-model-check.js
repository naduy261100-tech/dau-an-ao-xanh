const statusEl = document.getElementById("status");
const detailsEl = document.getElementById("details");
const report = (status, details = "") => {
  statusEl.textContent = status;
  detailsEl.textContent = details;
  document.body.dataset.status = status.startsWith("PASS") ? "pass" : status.startsWith("FAIL") ? "fail" : "running";
};
async function run() {
  try {
    report("Loading local BiRefNet background remover…");
    const module = await import("https://cdn.jsdelivr.net/npm/@bg0/browser@0.1.1/+esm");
    if (typeof module.removeBackground !== "function") throw new Error("removeBackground export missing");
    report("Downloading public portrait sample…");
    const response = await fetch("https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1000");
    if (!response.ok) throw new Error("Public sample image failed: HTTP " + response.status);
    const inputBlob = await response.blob();
    const sourceUrl = URL.createObjectURL(inputBlob);
    document.getElementById("source").src = sourceUrl;
    report("Running BiRefNet segmentation locally…", "No photo is sent to the server.");
    const result = await module.removeBackground(new File([inputBlob], "public-test.jpg", { type: inputBlob.type }), {
      model: "lite",
      quality: "quality",
      onProgress: p => report("BiRefNet: " + p.stage + " · " + Math.round(p.progress * 100) + "%", p.message || "")
    });
    if (!result.blob || result.blob.type !== "image/png") throw new Error("Expected transparent PNG, got " + result.blob?.type);
    const resultUrl = URL.createObjectURL(result.blob);
    document.getElementById("cutout").src = resultUrl;
    const bitmap = await createImageBitmap(result.blob);
    const canvas = document.getElementById("mask");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0, opaque = 0, soft = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      const a = pixels[i];
      if (a < 10) transparent++;
      else if (a > 245) opaque++;
      else soft++;
    }
    const data = {
      model: result.model, provider: result.provider, quality: result.quality,
      width: result.width, height: result.height, durationMs: result.durationMs,
      pngBytes: result.blob.size,
      transparency: { transparent, soft, opaque }
    };
    bitmap.close();
    URL.revokeObjectURL(sourceUrl);
    report("PASS — BiRefNet returned a transparent cutout.", JSON.stringify(data, null, 2));
  } catch (error) {
    report("FAIL — " + (error?.message || String(error)), error?.stack || "");
  }
}
run();