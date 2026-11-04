(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = {
    serviceNote: $("serviceNote"), serviceText: $("serviceText"),
    consentCheck: $("consentCheck"), consentDescription: $("consentDescription"),
    consentWarning: $("consentWarning"), consentLabel: $("consentLabel"),
    startBtn: $("startBtn"), startControls: $("startControls"),
    cameraControls: $("cameraControls"), resultControls: $("resultControls"),
    cameraPlaceholder: $("cameraPlaceholder"), cameraVideo: $("cameraVideo"),
    cameraBadge: $("cameraBadge"), resultBadge: $("resultBadge"),
    resultImage: $("resultImage"), captureBtn: $("captureBtn"),
    switchBtn: $("switchBtn"), downloadBtn: $("downloadBtn"), retakeBtn: $("retakeBtn"),
    processingPanel: $("processingPanel"), errorBox: $("errorBox"),
    processingTitle: $("processingTitle"),
    nativeCaptureControls: $("nativeCaptureControls"),
    nativeCaptureBtn: $("nativeCaptureBtn"),
    nativeCameraInput: $("nativeCameraInput")
  };

  let stream = null;
  let facingMode = "environment";
  let mode = "locked";
  let resultUrl = null;
  let processing = false;
  let segmenterPromise = null;

  function notice(message, state) {
    el.serviceNote.className = "service-note" + (state ? " " + state : "");
    el.serviceText.textContent = message;
  }

  function showError(message) {
    el.errorBox.textContent = message;
    el.errorBox.hidden = false;
  }

  function clearError() {
    el.errorBox.textContent = "";
    el.errorBox.hidden = true;
  }

  function updateStartState() {
    el.startBtn.disabled = mode !== "free-ai" || !el.consentCheck.checked || processing;
  }

  async function checkService() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Health check failed");
      const data = await response.json();
      mode = data.ready === true ? "free-ai" : "locked";
      el.consentDescription.textContent =
        "Ảnh của bạn được tách chủ thể và ghép nền ngay trên điện thoại. Ảnh gốc không tải lên máy chủ. Máy chủ AI chỉ nhận mô tả phong cảnh chung để tạo nền thiên nhiên, sau đó ảnh được ghép hoàn chỉnh ngay trên thiết bị.";
      el.consentWarning.textContent =
        "Không dùng ảnh người khác khi chưa được phép. Với ảnh học sinh, nhà trường cần hoàn tất việc xin chấp thuận phù hợp trước khi tổ chức hoạt động.";
      el.consentLabel.textContent =
        "Tôi là người trong ảnh hoặc đã được người trong ảnh/người đại diện cho phép sử dụng ảnh này và đồng ý xử lý trên thiết bị.";
      if (mode === "free-ai") {
        notice("AI tạo nền đang sẵn sàng bằng hạn mức miễn phí hằng ngày của Cloudflare. Ảnh của bạn được xử lý ngay trên điện thoại.", "ready");
      } else {
        notice("Dịch vụ tạo nền AI chưa sẵn sàng. Vui lòng thử lại sau.", "error");
      }
      updateStartState();
    } catch (_) {
      mode = "locked";
      updateStartState();
      notice("Chưa kết nối được dịch vụ AI. Vui lòng kiểm tra Internet rồi tải lại trang.", "error");
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    el.cameraVideo.srcObject = null;
  }

  async function waitForCameraRelease() {
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  async function requestCamera(mode) {
    const media = navigator.mediaDevices;
    const dimensions = {
      width: { ideal: 1280 },
      height: { ideal: 1600 }
    };

    // First request the requested lens explicitly. "ideal" alone can silently
    // return the front camera when the back camera was requested.
    try {
      return await media.getUserMedia({
        audio: false,
        video: { ...dimensions, facingMode: { exact: mode } }
      });
    } catch (exactError) {
      if (exactError?.name === "NotAllowedError" || exactError?.name === "PermissionDeniedError" ||
          exactError?.name === "SecurityError" || exactError?.name === "NotReadableError") {
        throw exactError;
      }
    }

    // Some mobile browsers ignore facingMode but expose device labels after
    // the first permission grant. Pick the camera whose label identifies its
    // physical direction, then request that device by its exact deviceId.
    let cameras = [];
    try {
      const devices = await media.enumerateDevices();
      cameras = devices.filter(device => device.kind === "videoinput");
    } catch (_) {}

    if (!cameras.length) {
      throw new Error("Trình duyệt không tìm thấy camera. Hãy kiểm tra quyền Camera và thử lại.");
    }

    const isRear = mode === "environment";
    const pattern = isRear
      ? /(back|rear|environment|world|sau|arrière|trasera|背面|外側)/i
      : /(front|user|facetime|selfie|trước|前面|内側)/i;

    let candidates = cameras.filter(device => pattern.test(device.label || ""));
    if (!candidates.length) {
      // On many phones the front camera is listed first and rear cameras after it.
      // If labels are hidden, use the last camera for rear and first for front.
      candidates = [isRear && cameras.length > 1 ? cameras[cameras.length - 1] : cameras[0]];
    }

    let lastError;
    for (const camera of candidates) {
      try {
        return await media.getUserMedia({
          audio: false,
          video: { ...dimensions, deviceId: { exact: camera.deviceId } }
        });
      } catch (error) {
        lastError = error;
        if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") throw error;
      }
    }

    if (isRear) {
      throw new Error("Không mở được camera sau trên trình duyệt này. Hãy thử nút “MỞ CAMERA ĐIỆN THOẠI (DỰ PHÒNG)” bên dưới.");
    }
    if (lastError) throw lastError;
    throw new Error("Không mở được camera. Hãy kiểm tra quyền truy cập camera của trình duyệt.");
  }

  async function openCamera() {
    clearError();
    if (mode !== "free-ai") {
      showError("Dịch vụ tạo nền AI đang tạm thời chưa sẵn sàng.");
      return;
    }
    if (!el.consentCheck.checked) {
      showError("Vui lòng đọc thông tin xử lý ảnh và xác nhận trước khi bật camera.");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      el.nativeCaptureControls.hidden = false;
      showError("Trình duyệt không hỗ trợ camera trực tiếp. Bạn có thể dùng nút camera điện thoại bên dưới.");
      return;
    }

    stopCamera();
    await waitForCameraRelease();
    try {
      stream = await requestCamera(facingMode);
      const track = stream.getVideoTracks()[0];
      const settings = track && track.getSettings ? track.getSettings() : {};
      const actualFacing = settings.facingMode || facingMode;

      el.cameraVideo.srcObject = stream;
      el.cameraVideo.classList.toggle("front-camera", actualFacing === "user");
      await el.cameraVideo.play();

      el.cameraPlaceholder.hidden = true;
      el.cameraVideo.hidden = false;
      el.resultImage.hidden = true;
      el.cameraBadge.hidden = false;
      el.cameraBadge.textContent = actualFacing === "environment" ? "CAMERA SAU" : "CAMERA TRƯỚC";
      el.resultBadge.hidden = true;
      el.startControls.hidden = true;
      el.nativeCaptureControls.hidden = true;
      el.resultControls.hidden = true;
      el.cameraControls.hidden = false;
      el.switchBtn.textContent = actualFacing === "environment" ? "↻ CAMERA TRƯỚC" : "↻ CAMERA SAU";
    } catch (err) {
      stopCamera();
      el.cameraVideo.hidden = true;
      el.cameraBadge.hidden = true;
      el.cameraPlaceholder.hidden = false;
      el.cameraControls.hidden = true;
      el.startControls.hidden = false;
      const denied = err && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      el.nativeCaptureControls.hidden = false;
      showError(denied
        ? "Bạn chưa cấp quyền camera cho trình duyệt. Hãy cho phép Camera hoặc dùng nút camera điện thoại dự phòng."
        : (err instanceof Error ? err.message : "Không mở được camera. Hãy thử camera điện thoại dự phòng."));
    }
  }

  function estimateScene(canvas) {
    const probe = document.createElement("canvas");
    probe.width = 32;
    probe.height = 32;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    pctx.drawImage(canvas, 0, 0, 32, 32);
    const pixels = pctx.getImageData(0, 0, 32, 32).data;
    let brightness = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      brightness += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    }
    brightness /= pixels.length / 4;
    return brightness > 135 ? "rice" : "lake";
  }

  function canvasFromSource(source, sourceWidth, sourceHeight) {
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(sourceWidth * scale));
    canvas.height = Math.max(2, Math.round(sourceHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function captureFrame() {
    const video = el.cameraVideo;
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Camera chưa sẵn sàng. Vui lòng chờ một chút rồi chụp lại.");
    }
    const canvas = canvasFromSource(video, video.videoWidth, video.videoHeight);
    return { canvas, scene: estimateScene(canvas) };
  }

  async function createSegmenter() {
    if (segmenterPromise) return segmenterPromise;
    segmenterPromise = (async () => {
      if (typeof window.SelfieSegmentation !== "function") {
        throw new Error("Chưa tải được mô hình tách người. Vui lòng kiểm tra mạng và thử lại.");
      }
      const segmenter = new window.SelfieSegmentation({
        locateFile: (file) =>
          "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/" + file
      });
      await segmenter.setOptions({ modelSelection: 0 });
      return segmenter;
    })();
    try {
      return await segmenterPromise;
    } catch (err) {
      segmenterPromise = null;
      throw err;
    }
  }

  async function makePersonCutout(sourceCanvas) {
    const segmenter = await createSegmenter();
    const results = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Mô hình tách người xử lý quá lâu. Vui lòng chụp lại.")), 45000);
      segmenter.onResults((value) => {
        clearTimeout(timeout);
        resolve(value);
      });
      Promise.resolve(segmenter.send({ image: sourceCanvas })).catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    if (!results || !results.segmentationMask) {
      throw new Error("AI chưa tạo được mặt nạ tách người. Hãy chụp rõ toàn thân và tránh nền quá rối.");
    }

    // MediaPipe's mask is a grayscale confidence image. Do not rely on its
    // alpha channel: some browsers expose the mask as fully opaque even when
    // the RGB values contain the foreground/background confidence.
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
    maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);
    const maskPixels = maskCtx.getImageData(0, 0, width, height).data;

    const cutout = document.createElement("canvas");
    cutout.width = width;
    cutout.height = height;
    const ctx = cutout.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(sourceCanvas, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const probability = maskPixels[i] / 255;
        // Smooth the matte edge to retain hair/clothing contours without
        // leaving the rectangular original background visible.
        const t = Math.max(0, Math.min(1, (probability - 0.12) / 0.68));
        const alpha = t * t * (3 - 2 * t);
        pixels[i + 3] = Math.round(pixels[i + 3] * alpha);

        if (pixels[i + 3] > 36) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      throw new Error("Không nhận diện được người trong ảnh. Hãy đứng cách nền một khoảng, đủ sáng và chụp lại.");
    }

    ctx.putImageData(imageData, 0, 0);

    const margin = Math.round(Math.max(width, height) * 0.015);
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(width - 1, maxX + margin);
    maxY = Math.min(height - 1, maxY + margin);

    const trimmed = document.createElement("canvas");
    trimmed.width = maxX - minX + 1;
    trimmed.height = maxY - minY + 1;
    trimmed.getContext("2d").drawImage(
      cutout, minX, minY, trimmed.width, trimmed.height,
      0, 0, trimmed.width, trimmed.height
    );

    return {
      canvas: trimmed,
      touchesBottom: maxY >= height * 0.94,
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
      let message = "Không tạo được phong cảnh AI. Vui lòng thử lại sau.";
      try {
        const data = await response.json();
        if (typeof data.message === "string") message = data.message;
      } catch (_) {}
      throw new Error(message);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("Không nhận được ảnh nền hợp lệ.");
    const bitmap = await createImageBitmap(blob);
    return {
      bitmap,
      source: response.headers.get("x-background-source") || "flux-ai",
      attribution: response.headers.get("x-background-attribution") || ""
    };
  }

  function compositeImage(background, person) {
    const width = 1024;
    const height = 1280;
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const ctx = output.getContext("2d");

    const scale = Math.max(width / background.width, height / background.height);
    const bgWidth = background.width * scale;
    const bgHeight = background.height * scale;
    ctx.drawImage(background, (width - bgWidth) / 2, (height - bgHeight) / 2, bgWidth, bgHeight);

    // Gentle tonal wash to soften the join between the generated landscape and the foreground.
    const wash = ctx.createLinearGradient(0, 0, 0, height);
    wash.addColorStop(0, "rgba(224,235,220,0.025)");
    wash.addColorStop(1, "rgba(23,51,34,0.08)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);

    const personCanvas = person.canvas;
    const fit = Math.min((width * 0.9) / personCanvas.width, (height * 0.92) / personCanvas.height);
    const personWidth = personCanvas.width * fit;
    const personHeight = personCanvas.height * fit;
    const x = (width - personWidth) / 2;
    const bottomMargin = person.touchesBottom ? 8 : 24;
    const y = height - personHeight - bottomMargin;

    if (person.touchesBottom && person.aspect > 1.25) {
      ctx.save();
      ctx.filter = "blur(16px)";
      ctx.fillStyle = "rgba(10,24,16,0.30)";
      ctx.beginPath();
      ctx.ellipse(width / 2, height - 13, Math.min(personWidth * 0.28, width * 0.28), 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(personCanvas, x, y, personWidth, personHeight);

    const vignette = ctx.createRadialGradient(width / 2, height * 0.45, height * 0.2, width / 2, height * 0.45, height * 0.83);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(8,25,17,0.13)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    return new Promise((resolve, reject) => {
      output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không xuất được ảnh hoàn chỉnh.")), "image/jpeg", 0.94);
    });
  }

  async function processPhoto(sourceCanvas, scene) {
    if (processing) return;
    processing = true;
    clearError();
    stopCamera();

    el.cameraVideo.hidden = true;
    el.cameraBadge.hidden = true;
    el.cameraPlaceholder.hidden = true;
    el.resultImage.hidden = true;
    el.cameraControls.hidden = true;
    el.startControls.hidden = true;
    el.resultControls.hidden = true;
    el.processingPanel.hidden = false;
    el.captureBtn.disabled = true;
    el.processingTitle.textContent = "AI đang tách người và dựng phong cảnh…";
    notice("Đang xử lý người trong ảnh ngay trên điện thoại; máy chủ chỉ tạo nền thiên nhiên.", "");

    let backgroundBitmap = null;
    try {
      const person = await makePersonCutout(sourceCanvas);
      el.processingTitle.textContent = "AI đang sáng tạo phong cảnh Tuyên Quang…";
      backgroundBitmap = await generateBackground(scene);
      el.processingTitle.textContent = "Đang hòa phối ánh sáng và ghép ảnh…";
      const output = await compositeImage(backgroundBitmap.bitmap, person);

      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(output);
      el.resultImage.src = resultUrl;
      el.resultImage.hidden = false;
      el.resultBadge.hidden = false;
      el.resultControls.hidden = false;
      el.processingPanel.hidden = true;
      if (backgroundBitmap.source === "photo-fallback") {
        const credit = backgroundBitmap.attribution ? " Ảnh phong cảnh: " + backgroundBitmap.attribution + "." : "";
        notice("Đã ghép xong: AI tách người và phối ảnh trên điện thoại; nền là ảnh phong cảnh thật vì mô hình tạo nền đang bận." + credit, "ready");
      } else {
        notice("Ảnh đã được AI tạo nền và ghép hoàn chỉnh. Bạn có thể tải ảnh về điện thoại.", "ready");
      }
    } catch (err) {
      el.processingPanel.hidden = true;
      el.startControls.hidden = false;
      el.cameraPlaceholder.hidden = false;
      notice("Chưa hoàn tất xử lý ảnh.", "error");
      showError(err instanceof Error ? err.message : "Có lỗi khi xử lý ảnh. Vui lòng thử lại.");
      await checkService();
    } finally {
      if (backgroundBitmap?.bitmap && typeof backgroundBitmap.bitmap.close === "function") backgroundBitmap.bitmap.close();
      processing = false;
      el.captureBtn.disabled = false;
      updateStartState();
    }
  }

  el.consentCheck.addEventListener("change", updateStartState);
  el.startBtn.addEventListener("click", openCamera);

  el.captureBtn.addEventListener("click", async () => {
    try {
      const photo = captureFrame();
      await processPhoto(photo.canvas, photo.scene);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Không chụp được ảnh.");
    }
  });

  el.switchBtn.addEventListener("click", async () => {
    facingMode = facingMode === "user" ? "environment" : "user";
    await openCamera();
  });

  el.nativeCaptureBtn.addEventListener("click", () => {
    clearError();
    el.nativeCameraInput.click();
  });

  el.nativeCameraInput.addEventListener("change", async () => {
    const file = el.nativeCameraInput.files && el.nativeCameraInput.files[0];
    if (!file) return;
    try {
      if (!file.type.startsWith("image/")) throw new Error("Tệp vừa chọn không phải ảnh.");
      const bitmap = await createImageBitmap(file);
      const canvas = canvasFromSource(bitmap, bitmap.width, bitmap.height);
      if (typeof bitmap.close === "function") bitmap.close();
      el.nativeCaptureControls.hidden = true;
      el.startControls.hidden = true;
      await processPhoto(canvas, estimateScene(canvas));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Không đọc được ảnh từ camera điện thoại.");
      el.nativeCaptureControls.hidden = false;
    } finally {
      el.nativeCameraInput.value = "";
    }
  });

  el.downloadBtn.addEventListener("click", () => {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = "Dau-an-Ao-xanh-Minh-Khuong-" + new Date().toISOString().slice(0, 10) + ".jpg";
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  el.retakeBtn.addEventListener("click", async () => {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      resultUrl = null;
    }
    el.resultImage.removeAttribute("src");
    el.resultImage.hidden = true;
    el.resultBadge.hidden = true;
    el.resultControls.hidden = true;
    el.cameraPlaceholder.hidden = false;
    el.startControls.hidden = false;
    clearError();
    updateStartState();
  });

  window.addEventListener("pagehide", () => {
    stopCamera();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  });

  checkService();
})();
