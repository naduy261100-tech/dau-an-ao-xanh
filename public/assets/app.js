(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = {
    consentScreen: $("consentScreen"),
    consentCheck: $("consentCheck"),
    agreeButton: $("agreeButton"),
    sceneGrid: $("sceneGrid"),
    teacherDayGrid: $("teacherDayGrid"),
    cameraVideo: $("cameraVideo"),
    capturePhotoBtn: $("capturePhotoBtn"),
    nativeCameraFallbackBtn: $("nativeCameraFallbackBtn"),
    modeOptions: document.querySelectorAll("[data-mode]"),
    modeDisclaimer: $("modeDisclaimer"),
    privacyTitle: $("privacyTitle"),
    privacyMessage: $("privacyMessage"),
    uploadPhotoBtn: $("uploadPhotoBtn"),
    uploadPhotoCameraBtn: $("uploadPhotoCameraBtn"),
    uploadPhotoInput: $("uploadPhotoInput"),
    reprocessBtn: $("reprocessBtn"),
    savedPhotoNotice: $("savedPhotoNotice"),
    chooseSceneBtn: $("chooseSceneBtn"),
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
    "rice-gold": { title: "Ruộng bậc thang vàng", author: "Quang Nguyen Vinh / Pexels" },
    "rice-green": { title: "Thung lũng ruộng xanh", author: "Duc Nguyen / Pexels" },
    "rice-path": { title: "Con đường giữa ruộng", author: "Ahmet Yüksek / Pexels" },
    "village-stone": { title: "Đường đá bản làng", author: "Beyza Kaplan / Pexels" },
    "village-road": { title: "Đường làng miền núi", author: "Thanh Luu / Pexels" },
    "hill-path": { title: "Lối mòn đồi xanh", author: "Tường Chopper / Pexels" },
    "wood-bridge": { title: "Cầu gỗ giữa rừng", author: "Quang Nguyen Vinh / Pexels" },
    "garden-walk": { title: "Lối vườn xanh", author: "nhavantuonglai / Pexels" },
    "traditional-garden": { title: "Vườn nhà gỗ", author: "juliber Tran / Pexels" },
    "flower-garden": { title: "Vườn hoa rực rỡ", author: "Nguyễn Tiến Thịnh / Pexels" },
    "waterfall": { title: "Thác rừng trên bậc đá", author: "Pexels" },
    "teacher-day-20-11": { title: "Cổng tri ân ngày 20/11", author: "Phông nền Trường Tiểu học Minh Khương" }
  };

  let selectedScene = "rice-gold";
  let selectedMode = "ai-background";
  let currentPhotoFile = null;
  let serviceReady = false;
  let consentAccepted = false;
  let processing = false;
  let matteRemoverPromise = null;
  let matteRemoverInstance = null;
  let matteModelName = "";
  let resultBlob = null;
  let resultUrl = null;
  let downloadBusy = false;
  let cameraStream = null;
  let cameraSessionId = 0;
  let cameraWarmupPromise = null;
  let captureSequence = 0;

  function showScreen(name) {
    if (name !== "camera") stopCameraStream();
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
      const status = await response.json();
      if (status.ready !== true) throw new Error("AI binding is not configured");
      // Health confirms configuration only; the actual AI quota is checked
      // when a background is generated, without spending Neurons here.
      serviceReady = true;
      updateAgreeButton();
    } catch (_) {
      serviceReady = false;
      el.agreeButton.disabled = true;
      showError("Chưa kết nối được dịch vụ. Vui lòng kiểm tra Internet rồi tải lại trang.");
    }
  }

  function updateSavedPhotoControls() {
    const hasPhoto = Boolean(currentPhotoFile);
    el.savedPhotoNotice.hidden = !hasPhoto;
    el.reprocessBtn.hidden = !hasPhoto;
    if (hasPhoto) {
      el.savedPhotoNotice.textContent = "Đã giữ ảnh " + (currentPhotoFile.name || "vừa chọn") + " trong phiên này. Chọn phong cảnh khác rồi ghép lại mà không cần chụp lại.";
    }
  }

  function updateAgreeButton() {
    const allowed = serviceReady && Boolean(el.consentCheck.checked);
    el.agreeButton.disabled = !allowed;
    el.uploadPhotoBtn.disabled = !allowed;
    el.reprocessBtn.disabled = !allowed || !currentPhotoFile || processing;
    updateSavedPhotoControls();
  }

  function selectMode(mode) {
    if (mode !== "ai-background" && mode !== "library") return;
    // The 20/11 arch is one fixed original school backdrop, not a generated landscape.
    if (selectedScene === "teacher-day-20-11") mode = "library";
    selectedMode = mode;
    for (const button of el.modeOptions) {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    if (mode === "ai-background") {
      el.privacyReminder.textContent = "Ảnh người không rời khỏi thiết bị; chỉ câu lệnh tạo phong cảnh được gửi tới Cloudflare AI.";
      el.modeDisclaimer.textContent = "Mỗi lượt ghép, AI tạo một phong cảnh mới theo chủ đề đã chọn. Người chụp được lấy trực tiếp từ ảnh gốc; AI không vẽ lại khuôn mặt.";
      el.privacyTitle.textContent = "Nền AI tạo mới · giữ khuôn mặt gốc";
      el.privacyMessage.textContent = "Máy chủ chỉ nhận mã chủ đề và câu lệnh tạo cảnh. Ảnh người được giữ trong trình duyệt và ghép trên điện thoại.";
    } else {
      el.privacyReminder.textContent = "Ảnh gốc không rời khỏi thiết bị của bạn.";
      el.modeDisclaimer.textContent = "Dùng ảnh phong cảnh cố định trong thư viện. Người chụp vẫn được lấy trực tiếp từ ảnh gốc, không bị AI tạo sinh vẽ lại khuôn mặt.";
      el.privacyTitle.textContent = "Nền thư viện · giữ khuôn mặt gốc";
      el.privacyMessage.textContent = "Ảnh cá nhân không tải lên máy chủ. Chỉ mã phông nền đã chọn được gửi để lấy ảnh phong cảnh.";
    }
    el.agreeButton.innerHTML = 'ĐỒNG Ý & MỞ CAMERA <span aria-hidden="true">→</span>';
    updateAgreeButton();
    clearError();
  }

  function selectScene(id) {
    if (!SCENES[id]) return;
    selectedScene = id;
    if (id === "teacher-day-20-11") selectMode("library");
    for (const button of document.querySelectorAll("[data-scene]")) {
      const active = button.dataset.scene === id;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    clearError();
  }

  function stopCameraStream() {
    cameraSessionId++;
    if (cameraStream) {
      for (const track of cameraStream.getTracks()) track.stop();
      cameraStream = null;
    }
    if (el.cameraVideo) el.cameraVideo.srcObject = null;
    if (el.capturePhotoBtn) el.capturePhotoBtn.disabled = true;
  }

  async function warmMattingModel() {
    if (!cameraWarmupPromise) {
      cameraWarmupPromise = createMattingEngine((fraction, modelName) => {
        if (!el.cameraScreen.hidden) {
          const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
          el.cameraStatusText.textContent = "Đang chuẩn bị mô hình tách người " + modelName + " (" + percent + "%). Camera đã mở; ảnh chỉ được xử lý trên thiết bị.";
        }
      }).catch(error => {
        cameraWarmupPromise = null;
        throw error;
      });
    }
    return cameraWarmupPromise;
  }

  async function startLiveCamera() {
    // Release any previous camera track before opening a fresh session.
    stopCameraStream();
    const thisSession = ++cameraSessionId;
    el.capturePhotoBtn.disabled = true;
    el.cameraStatusTitle.textContent = "Đang kết nối camera…";
    el.cameraStatusText.textContent = "Đang mở camera sau và chuẩn bị bộ tách người cho lần chụp đầu tiên.";
    if (!navigator.mediaDevices?.getUserMedia) {
      el.cameraStatusTitle.textContent = "Thiết bị chưa hỗ trợ camera trực tiếp";
      el.cameraStatusText.textContent = "Bạn vẫn có thể mở camera điện thoại bằng nút dự phòng bên dưới hoặc chọn ảnh từ thiết bị.";
      el.nativeCameraFallbackBtn.hidden = false;
      return;
    }
    try {
      // Start downloading/loading the matting model while the camera starts.
      const warmup = warmMattingModel();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 0.75 }
        }
      });
      if (thisSession !== cameraSessionId || el.cameraScreen.hidden) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      cameraStream = stream;
      el.cameraVideo.srcObject = stream;
      await el.cameraVideo.play();
      if (thisSession !== cameraSessionId) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      el.cameraStatusTitle.textContent = "Camera đã mở";
      el.cameraStatusText.textContent = "Đang hoàn tất khởi tạo AI lần đầu. Giữ máy thẳng, đứng cách camera khoảng 2–3 m và để đủ cả người trong khung hình.";
      await warmup;
      if (thisSession !== cameraSessionId || el.cameraScreen.hidden) return;
      el.capturePhotoBtn.disabled = false;
      el.cameraStatusTitle.textContent = "Đã sẵn sàng chụp";
      el.cameraStatusText.textContent = "Khung hình trực tiếp đã sẵn sàng. Mỗi lần bấm chụp sẽ lấy một ảnh mới, không dùng lại ảnh chụp trước.";
      el.nativeCameraFallbackBtn.hidden = true;
    } catch (error) {
      if (thisSession !== cameraSessionId) return;
      stopCameraStream();
      el.cameraStatusTitle.textContent = "Chưa mở được camera trực tiếp";
      el.cameraStatusText.textContent = (error instanceof Error ? error.message : "Trình duyệt chưa cấp quyền camera.") + " Bạn có thể dùng camera dự phòng hoặc chọn ảnh từ thiết bị.";
      el.nativeCameraFallbackBtn.hidden = false;
    }
  }

  async function captureLivePhoto() {
    if (!cameraStream || !el.cameraVideo.videoWidth || !el.cameraVideo.videoHeight || processing) return;
    el.capturePhotoBtn.disabled = true;
    el.cameraStatusTitle.textContent = "Đang chụp ảnh mới…";
    try {
      const video = el.cameraVideo;
      // Wait for the next decoded camera frame, not merely the next paint.
      await new Promise(resolve => {
        if (typeof video.requestVideoFrameCallback === "function") {
          video.requestVideoFrameCallback(() => resolve());
        } else {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }
      });
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        throw new Error("Camera chưa có khung hình mới. Vui lòng đợi hình ảnh hiện rõ rồi chụp lại.");
      }

      // Match the exact 3:4 portrait crop visible in the camera preview.
      // Without this crop, a landscape video frame could be saved wider than
      // the preview, making the processed photo look like it used an old frame.
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      const previewAspect = 3 / 4;
      const sourceAspect = sourceWidth / sourceHeight;
      let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;
      if (sourceAspect > previewAspect) {
        sw = sourceHeight * previewAspect;
        sx = (sourceWidth - sw) / 2;
      } else if (sourceAspect < previewAspect) {
        sh = sourceWidth / previewAspect;
        sy = (sourceHeight - sh) / 2;
      }
      const scale = Math.min(1, 2560 / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round(sw * scale));
      canvas.height = Math.max(2, Math.round(sh * scale));
      const context = canvas.getContext("2d");
      context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(value => value ? resolve(value) : reject(new Error("Không lưu được khung hình camera. Vui lòng chụp lại.")), "image/jpeg", 0.96);
      });
      const captureId = ++captureSequence;
      const freshFile = new File([blob], "minh-khuong-" + Date.now() + "-" + captureId + ".jpg", {
        type: "image/jpeg",
        lastModified: Date.now()
      });
      currentPhotoFile = freshFile;
      updateSavedPhotoControls();
      clearResult();
      await processPhoto(freshFile);
    } catch (error) {
      el.cameraStatusTitle.textContent = "Chưa chụp được ảnh";
      el.cameraStatusText.textContent = error instanceof Error ? error.message : "Có lỗi khi chụp ảnh. Vui lòng thử lại.";
      el.capturePhotoBtn.disabled = false;
    }
  }

  function openNativeCamera() {
    if (!consentAccepted || !el.consentCheck.checked) {
      showScreen("consent");
      showError("Vui lòng xác nhận quyền sử dụng ảnh trước khi mở camera.");
      updateAgreeButton();
      return;
    }
    clearError();
    showScreen("camera");
    startLiveCamera();
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
    const maxSide = 2560;
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

  async function createMattingEngine(onProgress) {
    if (matteRemoverInstance) return matteRemoverInstance;
    if (!matteRemoverPromise) {
      matteRemoverPromise = (async () => {
        const { BackgroundRemover } = await import(
          "https://cdn.jsdelivr.net/npm/@katana-video/web-bg-removal@0.1.1/+esm"
        );
        try {
          const remover = await BackgroundRemover.load("longpipe-xl", {
            backend: "auto",
            dtype: "auto",
            onProgress: fraction => onProgress?.(fraction, "Longpipe XL")
          });
          matteModelName = "Longpipe XL · 1280 × 768";
          return remover;
        } catch (xlError) {
          // Smaller person-matting fallback for devices with limited GPU memory.
          const remover = await BackgroundRemover.load("longpipe-large", {
            backend: "auto",
            dtype: "auto",
            onProgress: fraction => onProgress?.(fraction, "Longpipe Large")
          });
          matteModelName = "Longpipe Large · 640 × 400";
          return remover;
        }
      })();
    }
    try {
      matteRemoverInstance = await matteRemoverPromise;
      return matteRemoverInstance;
    } catch (error) {
      matteRemoverPromise = null;
      matteRemoverInstance = null;
      matteModelName = "";
      const detail = error instanceof Error ? error.message : String(error || "");
      throw new Error("Không tải được mô hình tách ảnh chất lượng cao. Hãy kiểm tra Internet và thử lại. " + detail);
    }
  }

  function removeBackgroundColorSpill(pixels, width, height) {
    // Decontaminate only soft matte pixels. Fully opaque face/skin/clothing
    // pixels remain unchanged, preserving the original facial RGB.
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const i = (y * width + x) * 4;
        const alpha = pixels[i + 3] / 255;
        if (alpha < 0.16 || alpha > 0.90) continue;
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = -2; dy <= 2; dy += 2) {
          for (let dx = -2; dx <= 2; dx += 2) {
            if (!dx && !dy) continue;
            const ni = ((y + dy) * width + x + dx) * 4;
            if (pixels[ni + 3] <= 8) {
              r += pixels[ni]; g += pixels[ni + 1]; b += pixels[ni + 2];
              count++;
            }
          }
        }
        if (count < 2) continue;
        const bgR = r / count, bgG = g / count, bgB = b / count;
        const inv = 1 / Math.max(0.16, alpha);
        const strength = Math.min(0.58, (1 - alpha) * 0.72);
        const fgR = Math.max(0, Math.min(255, (pixels[i] - (1 - alpha) * bgR) * inv));
        const fgG = Math.max(0, Math.min(255, (pixels[i + 1] - (1 - alpha) * bgG) * inv));
        const fgB = Math.max(0, Math.min(255, (pixels[i + 2] - (1 - alpha) * bgB) * inv));
        pixels[i] = Math.round(pixels[i] + (fgR - pixels[i]) * strength);
        pixels[i + 1] = Math.round(pixels[i + 1] + (fgG - pixels[i + 1]) * strength);
        pixels[i + 2] = Math.round(pixels[i + 2] + (fgB - pixels[i + 2]) * strength);
      }
    }
  }

  async function makePersonCutout(sourceCanvas, onProgress) {
    const remover = await createMattingEngine(onProgress);
    const sourceBitmap = await createImageBitmap(sourceCanvas);
    let matteBitmap = null;
    try {
      matteBitmap = await remover.removeBackground(sourceBitmap);
    } finally {
      try { sourceBitmap.close(); } catch (_) {}
    }
    if (!matteBitmap) throw new Error("Mô hình chưa tạo được mặt nạ tách người. Vui lòng thử lại.");

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const originalCanvas = document.createElement("canvas");
    originalCanvas.width = width;
    originalCanvas.height = height;
    const originalCtx = originalCanvas.getContext("2d", { willReadFrequently: true });
    originalCtx.drawImage(sourceCanvas, 0, 0);
    const originalImage = originalCtx.getImageData(0, 0, width, height);
    const originalPixels = originalImage.data;

    const matteCanvas = document.createElement("canvas");
    matteCanvas.width = width;
    matteCanvas.height = height;
    const matteCtx = matteCanvas.getContext("2d", { willReadFrequently: true });
    matteCtx.drawImage(matteBitmap, 0, 0, width, height);
    try { matteBitmap.close(); } catch (_) {}
    const mattePixels = matteCtx.getImageData(0, 0, width, height).data;

    let minX = width, minY = height, maxX = -1, maxY = -1;
    let opaqueCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        let alpha = mattePixels[i + 3];
        if (alpha < 4) alpha = 0;
        originalPixels[i + 3] = alpha;
        if (alpha > 12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        if (alpha > 224) opaqueCount++;
      }
    }
    if (maxX < minX || maxY < minY || opaqueCount < 1500) {
      throw new Error("Mô hình chưa nhận diện được người rõ ràng. Hãy chụp đủ sáng, để tóc và vai không bị che khuất.");
    }

    removeBackgroundColorSpill(originalPixels, width, height);
    originalCtx.putImageData(originalImage, 0, 0);
    const margin = Math.round(Math.max(width, height) * 0.006);
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(width - 1, maxX + margin);
    maxY = Math.min(height - 1, maxY + margin);

    const trimmed = document.createElement("canvas");
    trimmed.width = maxX - minX + 1;
    trimmed.height = maxY - minY + 1;
    trimmed.getContext("2d").drawImage(
      originalCanvas, minX, minY, trimmed.width, trimmed.height,
      0, 0, trimmed.width, trimmed.height
    );
    const aspect = trimmed.height / trimmed.width;
    const touchesBottom = maxY >= height * 0.97;
    // Full-length people can have a wide stance or a little floor below their shoes.
    // Do not require the alpha mask to touch the bottom of the original photo.
    const framing = aspect >= 1.72 ? "full-body" : "portrait";
    return { canvas: trimmed, touchesBottom, aspect, framing, matteModel: matteModelName };
  }

  function analyzeSubjectLight(subjectCanvas) {
    const sample = document.createElement("canvas");
    sample.width = 40;
    sample.height = 40;
    const ctx = sample.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(subjectCanvas, 0, 0, 40, 40);
    const data = ctx.getImageData(0, 0, 40, 40).data;
    let luminance = 0, warmth = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 180) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      luminance += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      warmth += (r - b) / Math.max(32, r + g + b);
      count++;
    }
    sample.width = sample.height = 0;
    if (!count) return { brightness: 0.52, warmth: 0 };
    return {
      brightness: Math.round((luminance / count) * 100) / 100,
      warmth: Math.round((warmth / count) * 100) / 100
    };
  }

  async function generateBackground(scene, mode, framing, light) {
    if (scene === "teacher-day-20-11") {
      const response = await fetch("/assets/teacher-day-20-11.webp", { cache: "force-cache" });
      if (!response.ok) throw new Error("Chưa tải được phông nền tri ân 20/11. Vui lòng tải lại trang.");
      const bitmap = await createImageBitmap(await response.blob());
      return {
        bitmap,
        source: "teacher-day-fixed",
        attribution: "Phông nền gốc · Trường Tiểu học Minh Khương",
        requestId: "",
        variant: "",
        cacheStatus: "static",
        model: ""
      };
    }
    const seed = Math.floor(Math.random() * 2147483646) + 1;
    const response = await fetch("/api/background", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ scene, mode, seed, framing, light })
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
      attribution: response.headers.get("x-background-attribution") || "",
      requestId: response.headers.get("x-background-request-id") || "",
      variant: response.headers.get("x-background-pool-variant") || "",
      cacheStatus: response.headers.get("x-background-cache") || "",
      model: response.headers.get("x-background-model") || ""
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

  function colorStatistics(canvas, sampleAlpha = true) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let r = 0, g = 0, b = 0, luma = 0, count = 0;
    const stride = Math.max(1, Math.floor(Math.sqrt((canvas.width * canvas.height) / 9000)));
    for (let y = 0; y < canvas.height; y += stride) {
      for (let x = 0; x < canvas.width; x += stride) {
        const i = (y * canvas.width + x) * 4;
        if (sampleAlpha && data[i + 3] < 190) continue;
        const rr = data[i], gg = data[i + 1], bb = data[i + 2];
        r += rr; g += gg; b += bb;
        luma += 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
        count++;
      }
    }
    if (!count) return { r: 128, g: 128, b: 128, luma: 128, warmth: 0 };
    r /= count; g /= count; b /= count; luma /= count;
    return { r, g, b, luma, warmth: (r - b) / Math.max(32, r + g + b) };
  }

  function sampleBackgroundRegion(ctx, x, y, w, h) {
    const x0 = Math.max(0, Math.min(ctx.canvas.width - 1, Math.round(x)));
    const y0 = Math.max(0, Math.min(ctx.canvas.height - 1, Math.round(y)));
    const sw = Math.max(1, Math.min(ctx.canvas.width - x0, Math.round(w)));
    const sh = Math.max(1, Math.min(ctx.canvas.height - y0, Math.round(h)));
    const sample = document.createElement("canvas");
    sample.width = sample.height = 36;
    const sctx = sample.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(ctx.canvas, x0, y0, sw, sh, 0, 0, 36, 36);
    return colorStatistics(sample, false);
  }

  function harmonizeSubject(subject, targetLight) {
    const canvas = document.createElement("canvas");
    canvas.width = subject.width;
    canvas.height = subject.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(subject, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const source = colorStatistics(canvas, true);
    // Small exposure and white-balance correction only: facial geometry and
    // original details remain unchanged, while the cutout no longer keeps
    // a visibly different global light temperature from the new environment.
    const gain = Math.max(0.94, Math.min(1.06, Math.pow(targetLight.luma / Math.max(35, source.luma), 0.16)));
    const warmShift = Math.max(-3.5, Math.min(3.5, (targetLight.warmth - source.warmth) * 15));
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 4) continue;
      data[i] = Math.max(0, Math.min(255, (data[i] - 128) * 1.015 + 128) * gain + warmShift);
      data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * 1.015 + 128) * gain);
      data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * 1.015 + 128) * gain - warmShift);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  async function compositeImage(background, person, sceneId) {
    const special20Nov = sceneId === "teacher-day-20-11";
    const width = 1600;
    const height = special20Nov ? Math.round(width * background.height / background.width) : 2000;
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const ctx = output.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (special20Nov) {
      // Keep the original complete 20/11 arch and all lettering/decorations.
      ctx.drawImage(background, 0, 0, width, height);
    } else {
      drawCover(ctx, background, 0, 0, width, height);
    }

    const originalSubject = person.canvas;
    const fullBody = person.framing === "full-body";
    let fit, subjectWidth, subjectHeight, x, y, footY;
    if (special20Nov) {
      fit = Math.min((width * 0.29) / originalSubject.width, (height * (fullBody ? 0.49 : 0.34)) / originalSubject.height);
      subjectWidth = originalSubject.width * fit;
      subjectHeight = originalSubject.height * fit;
      x = (width - subjectWidth) / 2;
      if (fullBody) {
        footY = Math.round(height * 0.895);
        y = footY - subjectHeight + (person.touchesBottom ? 1 : 3);
      } else {
        y = Math.round(height * 0.48);
        footY = y + subjectHeight;
      }
    } else {
      fit = Math.min((width * (fullBody ? 0.84 : 0.64)) / originalSubject.width, (height * (fullBody ? 0.88 : 0.68)) / originalSubject.height);
      subjectWidth = originalSubject.width * fit;
      subjectHeight = originalSubject.height * fit;
      x = (width - subjectWidth) / 2;
      const bottomMargin = person.touchesBottom ? 2 : 8;
      y = fullBody ? height - subjectHeight - bottomMargin : Math.round((height - subjectHeight) * 0.46);
      footY = Math.min(height - 3, y + subjectHeight * 0.994);
    }

    const groundStats = sampleBackgroundRegion(
      ctx,
      x - subjectWidth * 0.12,
      Math.min(height - 65, footY + (special20Nov ? -90 : 8)),
      subjectWidth * 1.24,
      special20Nov ? 85 : 95
    );
    const sideStats = sampleBackgroundRegion(
      ctx,
      Math.max(0, x - Math.max(10, subjectWidth * 0.09)),
      Math.max(0, y + subjectHeight * 0.25),
      Math.max(10, subjectWidth * 0.09),
      Math.max(30, subjectHeight * 0.5)
    );
    const ambientLight = {
      luma: groundStats.luma * 0.65 + sideStats.luma * 0.35,
      warmth: groundStats.warmth * 0.65 + sideStats.warmth * 0.35
    };
    const subject = harmonizeSubject(originalSubject, ambientLight);

    // Derive a gentle contact shadow from the real ground luminance and place
    // it directly beneath the shoes; this avoids the cut-paper/sticker effect.
    if (fullBody) {
      const shadowAlpha = Math.max(0.07, Math.min(0.18, 0.19 - (groundStats.luma / 255) * 0.09));
      ctx.save();
      ctx.filter = "blur(18px)";
      ctx.fillStyle = "rgba(12,18,14," + (shadowAlpha * 0.62).toFixed(3) + ")";
      ctx.beginPath();
      ctx.ellipse(width / 2 + subjectWidth * 0.025, footY - 2, Math.max(45, subjectWidth * 0.22), Math.max(12, subjectWidth * 0.024), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = "blur(4px)";
      ctx.fillStyle = "rgba(20,22,20," + (shadowAlpha * 0.72).toFixed(3) + ")";
      ctx.beginPath();
      ctx.ellipse(width / 2 + subjectWidth * 0.01, footY, Math.max(24, subjectWidth * 0.13), Math.max(4, subjectWidth * 0.009), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.filter = "none";
    ctx.drawImage(subject, x, y, subjectWidth, subjectHeight);
    ctx.restore();

    return new Promise((resolve, reject) => {
      output.toBlob(blob => blob ? resolve(blob) : reject(new Error("Không xuất được ảnh hoàn chỉnh.")), "image/jpeg", 0.98);
    });
  }

  async function processPhoto(file) {
    if (processing) return;
    processing = true;
    currentPhotoFile = file;
    updateSavedPhotoControls();
    clearError();
    showScreen("processing");
    setProgress(7, "ĐANG ĐỌC ẢNH", "Đang giữ nguyên ảnh gốc…", "Ảnh được xử lý ở độ phân giải cao ngay trên điện thoại.");
    let background = null;
    try {
      const sourceCanvas = await imageFileToCanvas(file);
      setProgress(20, "ĐANG NẠP MÔ HÌNH TÁCH ẢNH", "Đang chuẩn bị Longpipe XL…", "Lần đầu tải mô hình khoảng 14,5 MB; ảnh người vẫn ở trên thiết bị. Các lượt sau dùng bộ nhớ đệm.");
      const person = await makePersonCutout(sourceCanvas, (fraction, modelName) => {
        const percent = 20 + Math.max(0, Math.min(1, fraction)) * 22;
        setProgress(percent, "ĐANG TẢI MÔ HÌNH", "Đang nạp " + modelName + "…", "Chỉ tải trọng số mô hình về trình duyệt; không tải ảnh cá nhân lên máy chủ.");
      });
      setProgress(44, "ĐANG TÁCH NGƯỜI CHI TIẾT", "Đang tinh chỉnh tóc và mép cơ thể…", "Dùng mô hình alpha matting chuyên cho người; giữ lại điểm ảnh gốc của khuôn mặt.");
      setProgress(48, "ĐANG TẠO PHÔNG NỀN",
        selectedMode === "ai-background" ? "AI đang sáng tạo phong cảnh mới…" : "Đang tải ảnh nền thư viện…",
        selectedMode === "ai-background"
          ? "AI tạo một cảnh mới theo chủ đề bạn đã chọn. Ảnh người vẫn ở trên điện thoại."
          : "Đang lấy ảnh phong cảnh cố định đã chọn.");
      const subjectLight = analyzeSubjectLight(person.canvas);
      background = await generateBackground(selectedScene, selectedMode, person.framing, subjectLight);
      setProgress(78, "ĐANG PHỐI GHÉP", "Đang hoàn thiện mép ảnh và ánh sáng…", "Giữ màu ảnh gốc, chỉ dùng alpha matting để tách tóc, vai và đường viền cơ thể.");
      const output = await compositeImage(background.bitmap, person, selectedScene);
      clearResult();
      resultBlob = output;
      resultUrl = URL.createObjectURL(output);
      el.resultImage.src = resultUrl;
      const scene = SCENES[selectedScene];
      if (background.source === "teacher-day-fixed") {
        el.resultDescription.textContent = "Phông cổng tri ân 20/11 được giữ nguyên toàn bộ. Người trong ảnh được căn vào khoảng trống giữa cổng, đặt chân trên mặt sân và cân chỉnh ánh sáng nhẹ trên thiết bị; ảnh người không gửi lên máy chủ.";
        el.resultMeta.textContent = "PHÔNG NỀN RIÊNG 20/11 · " + scene.title + " · " + (person.framing === "full-body" ? "Toàn thân · căn chân trên sân" : "Chân dung/bán thân") + " · Giữ chi tiết khuôn mặt gốc";
      } else if (background.source === "flux-ai") {
        el.resultDescription.textContent = "Phông nền được AI tạo mới riêng cho lượt ghép này. Người trong ảnh được lấy trực tiếp từ ảnh gốc và ghép trên thiết bị; ảnh người không được gửi lên AI." + (person.framing === "portrait" ? " Ảnh gốc là chân dung/bán thân nên bố cục được thu nhỏ theo kiểu chân dung, không tự tạo thêm phần cơ thể bị khuất." : "");
        el.resultMeta.textContent = "AI tạo mới · " + (background.model || "FLUX.1 Schnell") + " · " + scene.title + " · " + (person.matteModel || "Alpha matting trên thiết bị") + " · " + (person.framing === "full-body" ? "Toàn thân" : "Chân dung/bán thân") + " · Giữ khuôn mặt gốc";
      } else {
        el.resultDescription.textContent = "Người trong ảnh được giữ trực tiếp từ ảnh gốc và ghép với ảnh phong cảnh trong thư viện trên thiết bị." + (person.framing === "portrait" ? " Ảnh gốc là chân dung/bán thân nên bố cục được thu nhỏ theo kiểu chân dung, không tự tạo thêm phần cơ thể bị khuất." : "");
        el.resultMeta.textContent = "Nền thư viện · " + scene.title + " · " + (person.matteModel || "Alpha matting trên thiết bị") + " · " + (person.framing === "full-body" ? "Toàn thân" : "Chân dung/bán thân") + " · Giữ khuôn mặt gốc" + (background.attribution ? " · " + background.attribution : "");
      }
      el.downloadHelp.textContent = specialResultDescription(selectedScene);
      setProgress(100, "HOÀN TẤT", "Bức ảnh đã sẵn sàng!", "Có thể tải ảnh về, chụp lại hoặc quay lại chọn một phong cảnh khác để ghép cùng ảnh này.");
      await delay(350);
      showScreen("result");
    } catch (error) {
      showScreen("consent");
      showError(error instanceof Error ? error.message : "Có lỗi khi xử lý ảnh. Vui lòng thử lại.");
      updateAgreeButton();
    } finally {
      if (background?.bitmap && typeof background.bitmap.close === "function") background.bitmap.close();
      processing = false;
      updateAgreeButton();
    }
  }

  function specialResultDescription(sceneId) {
    return sceneId === "teacher-day-20-11" ? "Ảnh JPEG chất lượng cao. Giữ nguyên phông cổng chào 20/11 và ghép người ở chính giữa khoảng sân." : "Ảnh JPEG chất lượng cao. Khuôn mặt và trang phục được lấy từ ảnh gốc; ánh sáng được cân chỉnh nhẹ để hợp với phông nền.";
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
  el.teacherDayGrid?.addEventListener("click", event => {
    const button = event.target.closest("[data-scene]");
    if (button) selectScene(button.dataset.scene);
  });

  el.consentCheck.addEventListener("change", () => {
    updateAgreeButton();
    clearError();
  });

  el.agreeButton.addEventListener("click", () => {
    if (!el.consentCheck.checked) {
      showError("Vui lòng xác nhận quyền sử dụng ảnh trước khi mở camera.");
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
  el.capturePhotoBtn.addEventListener("click", captureLivePhoto);
  el.nativeCameraFallbackBtn.addEventListener("click", () => {
    stopCameraStream();
    el.nativeCameraInput.value = "";
    el.nativeCameraInput.click();
  });
  el.uploadPhotoBtn.addEventListener("click", openUploadPicker);
  el.uploadPhotoCameraBtn.addEventListener("click", openUploadPicker);
  el.uploadPhotoInput.addEventListener("change", async () => {
    const file = el.uploadPhotoInput.files?.[0];
    if (file) await handlePhotoFile(file);
    el.uploadPhotoInput.value = "";
  });
  el.reprocessBtn.addEventListener("click", async () => {
    if (!currentPhotoFile) return;
    if (!consentAccepted || !el.consentCheck.checked) {
      showError("Vui lòng xác nhận quyền sử dụng ảnh trước khi ghép lại.");
      return;
    }
    await processPhoto(currentPhotoFile);
  });
  el.chooseSceneBtn.addEventListener("click", () => {
    showScreen("consent");
    updateSavedPhotoControls();
    updateAgreeButton();
    clearError();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  el.backToGalleryBtn.addEventListener("click", () => {
    stopCameraStream();
    showScreen("consent");
    updateAgreeButton();
    clearError();
  });

  async function handlePhotoFile(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      showScreen("consent");
      showError("Tệp đã chọn không phải là ảnh. Vui lòng chọn ảnh JPEG, PNG hoặc HEIC.");
      return;
    }
    // A newly selected/captured photo must never inherit the prior result.
    clearResult();
    currentPhotoFile = file;
    updateSavedPhotoControls();
    await processPhoto(file);
  }

  function openUploadPicker() {
    if (!el.consentCheck.checked) {
      showScreen("consent");
      showError("Vui lòng xác nhận quyền sử dụng ảnh trước khi tải ảnh lên để ghép.");
      updateAgreeButton();
      return;
    }
    consentAccepted = true;
    clearError();
    stopCameraStream();
    el.uploadPhotoInput.value = "";
    el.uploadPhotoInput.click();
  }

  el.nativeCameraInput.addEventListener("change", async () => {
    // Snapshot the selected bytes into a fresh File before clearing the input.
    // This prevents mobile camera pickers from reusing a previous File handle.
    const file = el.nativeCameraInput.files?.[0];
    if (file) {
      try {
        const bytes = await file.arrayBuffer();
        const fresh = new File([bytes], "minh-khuong-camera-" + Date.now() + ".jpg", {
          type: file.type || "image/jpeg",
          lastModified: Date.now()
        });
        await handlePhotoFile(fresh);
      } catch (error) {
        showScreen("consent");
        showError(error instanceof Error ? error.message : "Không đọc được ảnh camera mới.");
      }
    }
    el.nativeCameraInput.value = "";
  });

  el.nativeCameraInput.addEventListener("cancel", () => {
    showScreen("consent");
    showError("Bạn đã hủy chụp ảnh. Chọn phông nền rồi nhấn mở camera để thử lại.");
  });

  el.downloadBtn.addEventListener("click", downloadResult);
  el.retakeBtn.addEventListener("click", () => {
    clearResult();
    currentPhotoFile = null;
    updateSavedPhotoControls();
    openNativeCamera();
  });
  window.addEventListener("pagehide", () => {
    stopCameraStream();
    clearResult();
    try { matteRemoverInstance?.destroy?.(); } catch (_) {}
    matteRemoverInstance = null;
    matteRemoverPromise = null;
  });

  checkService();
})();