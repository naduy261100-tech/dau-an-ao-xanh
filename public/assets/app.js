(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = {
    consentScreen: $("consentScreen"),
    consentCheck: $("consentCheck"),
    agreeButton: $("agreeButton"),
    sceneGrid: $("sceneGrid"),
    modeOptions: document.querySelectorAll("[data-mode]"),
    modeDisclaimer: $("modeDisclaimer"),
    privacyTitle: $("privacyTitle"),
    privacyMessage: $("privacyMessage"),
    aiConsentRow: $("aiConsentRow"),
    aiUploadConsent: $("aiUploadConsent"),
    cameraScreen: $("cameraScreen"),
    cameraStatusTitle: $("cameraStatusTitle"),
    cameraStatusText: $("cameraStatusText"),
    openCameraAgainBtn: $("openCameraAgainBtn"),
    backToGalleryBtn: $("backToGalleryBtn"),
    nativeCameraInput: $("nativeCameraInput"),
    processingScreen: $("processingScreen"),
    processingTitle: $("processingTitle"),
    processingMessage: $("processingMessage"),
    privacyReminder: $("processingPrivacyReminder"),
    progressFill: $("progressFill"),
    progressLabel: $("progressLabel"),
    progressPercent: $("progressPercent"),
    resultScreen: $("resultScreen"),
    resultImage: $("resultImage"),
    resultDescription: $("resultDescription"),
    resultMeta: $("resultMeta"),
    downloadBtn: $("downloadBtn"),
    downloadHelp: $("downloadHelp"),
    retakeBtn: $("retakeBtn"),
    errorBox: $("errorBox")
  };

  const SCENES = {
    "rice-gold": { title: "Ruộng bậc thang vàng", author: "Quang Nguyen Vinh" },
    "rice-green": { title: "Thung lũng ruộng xanh", author: "Duc Nguyen" },
    "rice-path": { title: "Lối nhỏ giữa ruộng", author: "Ahmet Yüksek" },
    "mountain-lake": { title: "Hồ núi xanh", author: "Quang Nguyen Vinh" },
    "mist-lake": { title: "Hồ núi giữa rừng", author: "Red Nguyen" },
    "waterfall": { title: "Thác giữa rừng", author: "Pexels" },
    "forest-stream": { title: "Suối rừng xanh", author: "Ella Ragasa" }
  };

  let selectedScene = "rice-gold";
  let selectedMode = "private";
  let serviceReady = false;
  let consentAccepted = false;
  let processing = false;
  let segmenterPromise = null;
  let resultBlob = null;
  let resultUrl = null;
  let downloadBusy = false;

  function showScreen(name) {
    el.consentScreen.hidden = name !== "consent";
    el.cameraScreen.hidden = name !== "camera";
    el.processingScreen.hidden = name !== "processing";
    el.resultScreen.hidden = name !== "result";
  }
  function showError(message) {
    el.errorBox.textContent = message;
    el.errorBox.hidden = false;
  }
  function clearError() {
    el.errorBox.textContent = "";
    el.errorBox.hidden = true;
  }
  function setProgress(percent, label, title, message) {
    el.progressFill.style.width = percent + "%";
    el.progressPercent.textContent = percent + "%";
    el.progressLabel.textContent = label;
    el.processingTitle.textContent = title;
    el.processingMessage.textContent = message;
  }

  async function checkService() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Health check failed");
      // The real-photo library keeps capture available even when the free
      // generative model is temporarily busy or not configured.
      serviceReady = true;
      updateAgreeButton();
    } catch (_) {
      serviceReady = false;
      el.agreeButton.disabled = true;
      showError("Chưa kết nối được dịch vụ. Vui lòng kiểm tra Internet rồi tải lại trang.");
    }
  }

  function updateAgreeButton() {
    const generalConsent = Boolean(el.consentCheck.checked);
    const aiConsent = selectedMode !== "ai" || Boolean(el.aiUploadConsent.checked);
    el.agreeButton.disabled = !serviceReady || !generalConsent || !aiConsent;
  }

  function selectMode(mode) {
    if (mode !== "private" && mode !== "ai") return;
    if (selectedMode !== mode && mode === "ai") el.aiUploadConsent.checked = false;
    selectedMode = mode;
    for (const button of el.modeOptions) {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    const ai = mode === "ai";
    el.aiConsentRow.hidden = !ai;
    if (ai) {
      el.privacyReminder.textContent = "Ảnh đang được gửi tới Cloudflare AI để chỉnh sửa theo chấp thuận của bạn. Chế độ này dùng hạn mức miễn phí hằng ngày.";
      el.modeDisclaimer.textContent = "Ảnh gốc được gửi tới Cloudflare AI để chỉnh sửa bằng mô hình FLUX.2 Klein 4B. Miễn phí trong hạn mức 10.000 neurons/ngày của tài khoản; khi hết hạn mức, yêu cầu sẽ tạm dừng, không tự chuyển sang dịch vụ tính phí.";
      el.privacyTitle.textContent = "AI chỉnh ảnh qua Cloudflare (hạn mức miễn phí)";
      el.privacyMessage.textContent = "Ảnh chụp được gửi tới máy chủ Cloudflare và mô hình FLUX.2 Klein 4B của Black Forest Labs để ghép chỉnh sửa với ảnh phong cảnh đã chọn. Mô hình được Cloudflare đánh dấu Zero Data Retention; ứng dụng không ghi ảnh vào thư viện hoặc cơ sở dữ liệu.";
      el.agreeButton.innerHTML = 'MỞ CAMERA & DÙNG AI MIỄN PHÍ <span aria-hidden="true">→</span>';
    } else {
      el.privacyReminder.textContent = "Ảnh gốc không rời khỏi thiết bị của bạn.";
      el.modeDisclaimer.textContent = "Chế độ riêng tư xử lý toàn bộ ảnh trên điện thoại; kết quả ghép vẫn có thể chưa hoàn toàn tự nhiên.";
      el.privacyTitle.textContent = "Ảnh gốc được giữ trên điện thoại";
      el.privacyMessage.textContent = "Ảnh cá nhân không tải lên máy chủ. Máy chủ chỉ nhận mã phông nền đã chọn.";
      el.agreeButton.innerHTML = 'ĐỒNG Ý & MỞ CAMERA <span aria-hidden="true">→</span>';
    }
    updateAgreeButton();
    clearError();
  }

  function selectScene(id) {
    if (!SCENES[id]) return;
    selectedScene = id;
    for (const button of el.sceneGrid.querySelectorAll("[data-scene]")) {
      const active = button.dataset.scene === id;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    clearError();
  }

  function openNativeCamera() {
    if (!consentAccepted || !el.consentCheck.checked || (selectedMode === "ai" && !el.aiUploadConsent.checked)) {
      showScreen("consent");
      showError(selectedMode === "ai"
        ? "Vui lòng xác nhận cả quyền sử dụng ảnh và việc gửi ảnh lên AI trước khi mở camera."
        : "Vui lòng xác nhận quyền sử dụng ảnh trước khi mở camera.");
      updateAgreeButton();
      return;
    }
    clearError();
    el.nativeCameraInput.value = "";
    el.cameraStatusTitle.textContent = "Đang mở camera chụp ảnh…";
    el.cameraStatusText.textContent = "Camera chụp ảnh của điện thoại sẽ xuất hiện. Chụp xong, ảnh sẽ tự chuyển sang bước AI xử lý.";
    showScreen("camera");
    // Call directly from the user gesture. No embedded video/player is used.
    el.nativeCameraInput.click();
  }

  function cropToPortrait(sourceWidth, sourceHeight) {
    const targetAspect = 4 / 5;
    const sourceAspect = sourceWidth / sourceHeight;
    let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;
    if (sourceAspect > targetAspect) {
      sw = sourceHeight * targetAspect;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / targetAspect;
      sy = (sourceHeight - sh) / 2;
    }
    return { sx, sy, sw, sh };
  }

  async function imageFileToCanvas(file) {
    const maxSide = 2048;
    let source = null;
    let sourceWidth = 0;
    let sourceHeight = 0;
    let closeSource = false;

    if (typeof createImageBitmap === "function") {
      try {
        source = await createImageBitmap(file);
        sourceWidth = source.width;
        sourceHeight = source.height;
        closeSource = true;
      } catch (_) {}
    }
    if (!source) {
      const objectUrl = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.decoding = "async";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("Không đọc được ảnh vừa chụp. Hãy thử chụp lại."));
          img.src = objectUrl;
        });
        source = img;
        sourceWidth = img.naturalWidth;
        sourceHeight = img.naturalHeight;
      } finally {
        // Keep the object URL until the image has been drawn below.
      }
    }

    if (!sourceWidth || !sourceHeight) throw new Error("Ảnh chụp không hợp lệ.");
    const maxScale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(2, Math.round(sourceWidth * maxScale));
    const height = Math.max(2, Math.round(sourceHeight * maxScale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d", { willReadFrequently: true }).drawImage(source, 0, 0, width, height);
    if (closeSource && typeof source.close === "function") source.close();
    if (source instanceof HTMLImageElement && source.src.startsWith("blob:")) URL.revokeObjectURL(source.src);
    return canvas;
  }

  async function createSegmenter() {
    if (segmenterPromise) return segmenterPromise;
    segmenterPromise = (async () => {
      if (typeof window.SelfieSegmentation !== "function") {
        throw new Error("Không tải được mô hình AI tách người. Hãy kiểm tra kết nối Internet và thử lại.");
      }
      const segmenter = new window.SelfieSegmentation({
        locateFile: file => "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/" + file
      });
      await segmenter.setOptions({ modelSelection: 0 });
      return segmenter;
    })();
    try {
      return await segmenterPromise;
    } catch (error) {
      segmenterPromise = null;
      throw error;
    }
  }

  async function makePersonCutout(sourceCanvas) {
    const segmenter = await createSegmenter();
    const results = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("AI tách người mất quá nhiều thời gian. Vui lòng thử lại.")), 45000);
      segmenter.onResults(result => {
        clearTimeout(timer);
        resolve(result);
      });
      Promise.resolve(segmenter.send({ image: sourceCanvas })).catch(error => {
        clearTimeout(timer);
        reject(error);
      });
    });
    if (!results?.segmentationMask) {
      throw new Error("AI chưa nhận diện được người. Hãy chụp đủ sáng, tránh để người khác che khuất.");
    }

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
    maskCtx.filter = "blur(1px)";
    maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);
    maskCtx.filter = "none";
    const mask = maskCtx.getImageData(0, 0, width, height).data;

    const cutout = document.createElement("canvas");
    cutout.width = width;
    cutout.height = height;
    const ctx = cutout.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(sourceCanvas, 0, 0);
    const image = ctx.getImageData(0, 0, width, height);
    const pixels = image.data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    let opaqueCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const probability = mask[i] / 255;
        const t = Math.max(0, Math.min(1, (probability - 0.10) / 0.78));
        const alpha = t * t * (3 - 2 * t);
        pixels[i + 3] = Math.round(pixels[i + 3] * alpha);
        if (alpha > 0.04) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        if (alpha > 0.88) opaqueCount++;
      }
    }

    if (maxX < minX || maxY < minY || opaqueCount < 1500) {
      throw new Error("AI chưa tách được chủ thể rõ ràng. Hãy đứng cách nền một khoảng và chụp đủ sáng.");
    }
    ctx.putImageData(image, 0, 0);

    const margin = Math.round(Math.max(width, height) * 0.018);
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(width - 1, maxX + margin);
    maxY = Math.min(height - 1, maxY + margin);

    const trimmed = document.createElement("canvas");
    trimmed.width = maxX - minX + 1;
    trimmed.height = maxY - minY + 1;
    trimmed.getContext("2d").drawImage(cutout, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);

    return {
      canvas: trimmed,
      touchesBottom: maxY >= height * 0.97,
      aspect: trimmed.height / trimmed.width
    };
  }

  async function generateBackground(scene) {
    const response = await fetch("/api/background", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ scene })
    });
    if (!response.ok) {
      let message = "Chưa tải được phông nền. Vui lòng thử lại.";
      try {
        const data = await response.json();
        if (typeof data.message === "string") message = data.message;
      } catch (_) {}
      throw new Error(message);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("Máy chủ không trả về ảnh nền hợp lệ.");
    const bitmap = await createImageBitmap(blob);
    return {
      bitmap,
      source: response.headers.get("x-background-source") || "photo-fallback",
      attribution: response.headers.get("x-background-attribution") || ""
    };
  }

  function drawCover(ctx, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function sampleLuminance(ctx, x, y, w, h) {
    const sample = document.createElement("canvas");
    sample.width = 24;
    sample.height = 24;
    const sctx = sample.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, 24, 24);
    const data = sctx.getImageData(0, 0, 24, 24).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    return sum / (24 * 24) / 255;
  }

  async function compositeImage(background, person) {
    const width = 1080;
    const height = 1350;
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const ctx = output.getContext("2d");

    drawCover(ctx, background, 0, 0, width, height);

    const subject = person.canvas;
    const fit = Math.min((width * 0.78) / subject.width, (height * 0.84) / subject.height);
    const subjectWidth = subject.width * fit;
    const subjectHeight = subject.height * fit;
    const x = (width - subjectWidth) / 2;
    const bottomMargin = person.touchesBottom ? 4 : 24;
    const y = height - subjectHeight - bottomMargin;
    const footY = Math.min(height - 8, y + subjectHeight * 0.985);

    // Contact shadow is deliberately subtle. Avoid outlining the whole cutout,
    // which made the subject look like a sticker on the earlier version.
    ctx.save();
    const groundBrightness = sampleLuminance(ctx, width * 0.3, height * 0.84, width * 0.4, height * 0.12);
    const shadowAlpha = Math.max(0.12, Math.min(0.27, 0.31 - groundBrightness * 0.16));
    ctx.filter = "blur(18px)";
    ctx.fillStyle = "rgba(12,22,14," + shadowAlpha.toFixed(3) + ")";
    ctx.beginPath();
    ctx.ellipse(width / 2 + subjectWidth * 0.025, footY, Math.max(45, subjectWidth * 0.24), Math.max(10, subjectWidth * 0.025), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw the subject only once with a restrained contact shadow.
    ctx.save();
    ctx.shadowColor = "rgba(10,24,15,0.18)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    const subjectBrightness = sampleLuminanceFromCanvas(subject);
    const adjust = Math.max(0.93, Math.min(1.06, 1 + (0.48 - groundBrightness) * 0.12));
    ctx.filter = "brightness(" + adjust.toFixed(3) + ") contrast(1.015) saturate(0.97)";
    ctx.drawImage(subject, x, y, subjectWidth, subjectHeight);
    ctx.restore();

    return new Promise((resolve, reject) => {
      output.toBlob(blob => blob ? resolve(blob) : reject(new Error("Không xuất được ảnh hoàn chỉnh.")), "image/jpeg", 0.95);
    });
  }

  function sampleLuminanceFromCanvas(canvas) {
    const sample = document.createElement("canvas");
    sample.width = 24;
    sample.height = 24;
    const ctx = sample.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, 24, 24);
    const d = ctx.getImageData(0, 0, 24, 24).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255;
      if (a > 0.7) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    }
    return sum / (24 * 24) / 255;
  }

  async function processPhoto(file) {
    if (processing) return;
    processing = true;
    clearError();
    showScreen("processing");
    setProgress(10, "ĐANG ĐỌC ẢNH", "AI đang xử lý hình ảnh…", "Đang đọc ảnh chụp và chuẩn bị nhận diện chủ thể.");
    let background = null;
    try {
      const sourceCanvas = await imageFileToCanvas(file);
      setProgress(28, "ĐANG TÁCH NGƯỜI", "AI đang tách chủ thể…", "Mô hình nhận diện người chạy ngay trên thiết bị của bạn.");
      const person = await makePersonCutout(sourceCanvas);
      setProgress(55, "ĐANG CHUẨN BỊ PHÔNG NỀN", "Chủ thể đã được tách", "Đang tải bối cảnh bạn đã chọn và căn chỉnh bố cục.");
      background = await generateBackground(selectedScene);
      setProgress(78, "ĐANG PHỐI GHÉP", "Đang hòa phối chủ thể và phong cảnh…", "Hệ thống căn chỉnh kích thước, bóng tiếp xúc và sắc độ tổng thể.");
      const output = await compositeImage(background.bitmap, person);
      clearResult();
      resultBlob = output;
      resultUrl = URL.createObjectURL(output);
      el.resultImage.src = resultUrl;
      const scene = SCENES[selectedScene];
      if (background.source === "flux-ai") {
        el.resultDescription.textContent = "AI đã tách chủ thể và tạo phông nền theo bối cảnh bạn chọn.";
      } else {
        el.resultDescription.textContent = "AI đã tách chủ thể và phối ghép với ảnh phong cảnh chụp thật bạn đã chọn.";
      }
      el.resultMeta.textContent = "Phông nền: " + scene.title + (background.attribution ? " · Ảnh: " + background.attribution : "");
      setProgress(100, "HOÀN TẤT", "Bức ảnh đã sẵn sàng!", "Bạn có thể tải ảnh về hoặc chụp lại bằng camera điện thoại.");
      await delay(300);
      showScreen("result");
    } catch (error) {
      showScreen("consent");
      showError(error instanceof Error ? error.message : "Có lỗi khi xử lý ảnh. Vui lòng thử lại.");
    } finally {
      if (background?.bitmap && typeof background.bitmap.close === "function") background.bitmap.close();
      processing = false;
    }
  }

  async function processPhotoWithAI(file) {
    if (processing) return;
    processing = true;
    clearError();
    showScreen("processing");
    setProgress(8, "ĐANG CHUẨN BỊ ẢNH", "Đang chuẩn bị gửi ảnh tới AI…", "Ảnh được nén trên thiết bị trước khi gửi theo chấp thuận của bạn.");
    try {
      const sourceCanvas = await imageFileToCanvas(file);
      // FLUX.2 Klein 4B multi-reference inputs must each be smaller than 512x512.
      // Keep the entire source photo visible instead of cutting off the person's head or feet.
      const uploadCanvas = document.createElement("canvas");
      uploadCanvas.width = 400;
      uploadCanvas.height = 500;
      const uploadCtx = uploadCanvas.getContext("2d");
      uploadCtx.fillStyle = "#e8e8e5";
      uploadCtx.fillRect(0, 0, uploadCanvas.width, uploadCanvas.height);
      const containScale = Math.min(uploadCanvas.width / sourceCanvas.width, uploadCanvas.height / sourceCanvas.height);
      const containedWidth = sourceCanvas.width * containScale;
      const containedHeight = sourceCanvas.height * containScale;
      uploadCtx.drawImage(
        sourceCanvas,
        (uploadCanvas.width - containedWidth) / 2,
        (uploadCanvas.height - containedHeight) / 2,
        containedWidth,
        containedHeight
      );
      const dataUrl = uploadCanvas.toDataURL("image/jpeg", 0.88);
      const imageBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (!imageBase64 || imageBase64.length > 1_500_000) {
        throw new Error("Không thể chuẩn bị ảnh để gửi tới AI. Vui lòng chụp lại.");
      }

      setProgress(32, "ĐANG GỬI ẢNH ĐÃ ĐƯỢC CHẤP THUẬN", "AI đang tiếp nhận ảnh…", "Ảnh gốc được gửi tới Cloudflare AI để chỉnh sửa bằng FLUX.2 Klein 4B trong hạn mức miễn phí 10.000 neurons/ngày. Ảnh tham chiếu được gửi ở kích thước tối ưu cho xử lý.");
      const response = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ scene: selectedScene, imageBase64, mimeType: "image/jpeg", consent: true })
      });
      if (!response.ok) {
        let message = "AI chưa chỉnh sửa được ảnh. Vui lòng thử lại hoặc chuyển sang chế độ riêng tư.";
        try {
          const data = await response.json();
          if (typeof data.message === "string") message = data.message;
        } catch (_) {}
        throw new Error(message);
      }
      setProgress(86, "ĐANG NHẬN ẢNH AI", "AI đã xử lý xong…", "Đang chuẩn bị ảnh kết quả để bạn kiểm tra.");
      const output = await response.blob();
      if (!output.type.startsWith("image/")) throw new Error("Mô hình AI không trả về ảnh hợp lệ.");
      clearResult();
      resultBlob = output;
      resultUrl = URL.createObjectURL(output);
      el.resultImage.src = resultUrl;
      el.resultDescription.textContent = "AI đã chỉnh sửa trực tiếp ảnh gốc và tạo lại bối cảnh theo lựa chọn. Hãy kiểm tra kỹ khuôn mặt, trang phục và các chi tiết trước khi tải ảnh.";
      el.resultMeta.textContent = "AI miễn phí · FLUX.2 Klein 4B · Phông nền: " + SCENES[selectedScene].title;
      setProgress(100, "HOÀN TẤT", "Ảnh AI đã sẵn sàng!", "Bạn có thể tải ảnh về hoặc chụp lại. AI dùng hạn mức miễn phí hằng ngày; khi hết hạn mức, hãy thử lại vào ngày hôm sau.");
      await delay(350);
      showScreen("result");
    } catch (error) {
      showScreen("consent");
      showError(error instanceof Error ? error.message : "Có lỗi khi gửi ảnh tới AI. Vui lòng thử lại.");
      updateAgreeButton();
    } finally {
      processing = false;
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function clearResult() {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    resultBlob = null;
    el.resultImage.removeAttribute("src");
  }

  async function downloadResult() {
    if (!resultBlob || !resultUrl || downloadBusy) return;
    downloadBusy = true;
    el.downloadBtn.disabled = true;
    const filename = "Dau-an-Ao-xanh-Minh-Khuong-" + new Date().toISOString().slice(0, 10) + ".jpg";
    try {
      const file = new File([resultBlob], filename, { type: "image/jpeg" });
      const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (isAppleMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Dấu ấn Áo xanh – Minh Khương" });
          el.downloadHelp.textContent = "Đã mở bảng chia sẻ. Chọn “Lưu hình ảnh” để lưu ảnh vào điện thoại.";
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      const link = document.createElement("a");
      link.href = resultUrl;
      link.download = filename;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (!("download" in HTMLAnchorElement.prototype)) {
        window.open(resultUrl, "_blank", "noopener");
        el.downloadHelp.textContent = "Ảnh đã mở ở thẻ mới. Nhấn giữ ảnh rồi chọn “Lưu hình ảnh”.";
      } else {
        el.downloadHelp.textContent = "Đã gửi lệnh tải ảnh. Kiểm tra thư mục Tải xuống hoặc Ảnh trên thiết bị.";
      }
    } catch (_) {
      window.open(resultUrl, "_blank", "noopener");
      el.downloadHelp.textContent = "Ảnh đã mở ở thẻ mới. Nhấn giữ ảnh rồi chọn “Lưu hình ảnh”.";
    } finally {
      el.downloadBtn.disabled = false;
      downloadBusy = false;
    }
  }

  for (const button of el.modeOptions) {
    button.addEventListener("click", () => selectMode(button.dataset.mode));
  }

  el.sceneGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-scene]");
    if (button) selectScene(button.dataset.scene);
  });

  el.consentCheck.addEventListener("change", () => {
    updateAgreeButton();
    clearError();
  });

  el.aiUploadConsent.addEventListener("change", () => {
    updateAgreeButton();
    clearError();
  });

  el.agreeButton.addEventListener("click", () => {
    if (!el.consentCheck.checked) {
      showError("Vui lòng xác nhận quyền sử dụng ảnh trước khi mở camera.");
      return;
    }
    if (selectedMode === "ai" && !el.aiUploadConsent.checked) {
      showError("Vui lòng đọc và chấp thuận riêng việc gửi ảnh tới dịch vụ AI.");
      return;
    }
    if (!serviceReady) {
      showError("Dịch vụ chưa kết nối. Vui lòng kiểm tra Internet rồi thử lại.");
      return;
    }
    consentAccepted = true;
    openNativeCamera();
  });

  el.openCameraAgainBtn.addEventListener("click", openNativeCamera);
  el.backToGalleryBtn.addEventListener("click", () => {
    showScreen("consent");
    consentAccepted = false;
    el.consentCheck.checked = false;
    updateAgreeButton();
    clearError();
  });

  el.nativeCameraInput.addEventListener("change", async () => {
    const file = el.nativeCameraInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showScreen("camera");
      showError("Tệp bạn chọn không phải là ảnh. Vui lòng chụp lại.");
      return;
    }
    if (selectedMode === "ai") await processPhotoWithAI(file);
    else await processPhoto(file);
    el.nativeCameraInput.value = "";
  });

  el.nativeCameraInput.addEventListener("cancel", () => {
    showScreen("consent");
    showError("Bạn đã hủy chụp ảnh. Chọn phông nền rồi nhấn mở camera để thử lại.");
  });

  el.downloadBtn.addEventListener("click", downloadResult);
  el.retakeBtn.addEventListener("click", () => {
    clearResult();
    openNativeCamera();
  });
  window.addEventListener("pagehide", clearResult);

  checkService();
})();