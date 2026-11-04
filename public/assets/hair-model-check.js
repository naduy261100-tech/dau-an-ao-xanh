const statusEl = document.getElementById("status");
const detailsEl = document.getElementById("details");
const report = (status, details = "") => {
  statusEl.textContent = status;
  detailsEl.textContent = details;
  document.body.dataset.status = status.startsWith("PASS") ? "pass" : status.startsWith("FAIL") ? "fail" : "running";
};
async function run() {
  try {
    report("Loading MediaPipe Tasks Vision…");
    const { FilesetResolver, ImageSegmenter } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/vision_bundle.mjs");
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm");
    report("Downloading and initializing HairSegmenter model…");
    const segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite",
        delegate: "CPU"
      },
      runningMode: "IMAGE",
      outputCategoryMask: false,
      outputConfidenceMasks: true
    });
    report("Loading public portrait…");
    const img = document.getElementById("sample");
    img.src = "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1000";
    await img.decode();
    report("Running hair segmentation inference…");
    const result = segmenter.segment(img);
    const labels = segmenter.getLabels?.() || [];
    const masks = result.confidenceMasks || [];
    const selectedIndex = Math.max(0, labels.findIndex(x => String(x).toLowerCase().includes("hair")));
    const mask = masks[selectedIndex] || masks[0];
    if (!mask) throw new Error("No confidence mask returned; labels=" + JSON.stringify(labels));
    const values = mask.getAsFloat32Array();
    let min = 1, max = 0, foreground = 0, mean = 0;
    const preview = document.getElementById("maskPreview");
    const ctx = preview.getContext("2d");
    const imageData = ctx.createImageData(mask.width, mask.height);
    for (let i = 0; i < values.length; i++) {
      const value = Math.max(0, Math.min(1, values[i]));
      min = Math.min(min, value);
      max = Math.max(max, value);
      mean += value;
      if (value > 0.5) foreground++;
      const p = Math.round(value * 255);
      const k = i * 4;
      imageData.data[k] = p;
      imageData.data[k + 1] = p;
      imageData.data[k + 2] = p;
      imageData.data[k + 3] = 255;
    }
    mean /= values.length;
    preview.width = mask.width;
    preview.height = mask.height;
    ctx.putImageData(imageData, 0, 0);
    const reportData = {
      labels, confidenceMaskCount: masks.length, selectedIndex,
      maskWidth: mask.width, maskHeight: mask.height,
      values: values.length, min, max, mean,
      foregroundAboveHalf: foreground
    };
    for (const item of masks) { try { item.close(); } catch (_) {} }
    try { result.categoryMask?.close?.(); } catch (_) {}
    segmenter.close();
    report("PASS — HairSegmenter loaded and returned a valid mask.", JSON.stringify(reportData, null, 2));
  } catch (error) {
    report("FAIL — " + (error?.message || String(error)), error?.stack || "");
  }
}
run();