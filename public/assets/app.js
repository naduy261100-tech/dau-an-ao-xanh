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
    processingTitle: $("processingTitle")
  };

  let stream = null;
  let facingMode = "user";
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
      showError("Trình duyệt chưa hỗ trợ camera trực tiếp. Hãy mở đường link bằng Safari hoặc Chrome phiên bản mới.");
      return;
    }

    stopCamera();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1600 },
          height: { ideal: 2000 },
          aspectRatio: { ideal: 0.8 }
        }
      });
      el.cameraVideo.srcObject = stream;
      el.cameraVideo.classList.toggle("front-camera", facingMode === "user");
      await el.cameraVideo.play();

      el.cameraPlaceholder.hidden = true;
      el.cameraVideo.hidden = false;
      el.resultImage.hidden = true;
      el.cameraBadge.hidden = false;
      el.resultBadge.hidden = true;
      el.startControls.hidden = true;
      el.resultControls.hidden = true;
      el.cameraControls.hidden = false;
    } catch (err) {
      const denied = err && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      showError(denied
        ? "Bạn chưa cho phép trình duyệt truy cập camera. Hãy bật quyền Camera trong cài đặt trình duyệt rồi thử lại."
        : "Không mở được camera. Hãy kiểm tra camera và thử lại.");
    }
  }

  function captureFrame() {
    const video = el.cameraVideo;
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Camera chưa sẵn sàng. Vui lòng chờ một chút rồi chụp lại.");
    }
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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

    return { canvas, scene: brightness > 135 ? "rice" : "lake" };
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
      throw new Error("AI chưa tách được người trong ảnh. Hãy chụp rõ người, tránh nền quá rối.");
    }

    const cutout = document.createElement("canvas");
    cutout.width = sourceCanvas.width;
    cutout.height = sourceCanvas.height;
    const ctx = cutout.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.filter = "blur(0.7px)";
    ctx.drawImage(results.segmentationMask, 0, 0, cutout.width, cutout.height);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";

    const pixels = ctx.getImageData(0, 0, cutout.width, cutout.height).data;
    let minX = cutout.width, minY = cutout.height, maxX = -1, maxY = -1;
    for (let y = 0; y < cutout.height; y += 3) {
      for (let x = 0; x < cutout.width; x += 3) {
        const alpha = pixels[(y * cutout.width + x) * 4 + 3];
        if (alpha > 36) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) {
      throw new Error("Không nhận diện được người trong ảnh. Hãy đứng cách nền một khoảng và chụp lại.");
    }

    const margin = Math.round(Math.max(cutout.width, cutout.height) * 0.012);
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(cutout.width - 1, maxX + margin);
    maxY = Math.min(cutout.height - 1, maxY + margin);

    const trimmed = document.createElement("canvas");
    trimmed.width = maxX - minX + 1;
    trimmed.height = maxY - minY + 1;
    trimmed.getContext("2d").drawImage(
      cutout, minX, minY, trimmed.width, trimmed.height,
      0, 0, trimmed.width, trimmed.height
    );
    return {
      canvas: trimmed,
      touchesBottom: maxY >= sourceCanvas.height * 0.94,
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
    if (!blob.type.startsWith("image/")) throw new Error("AI không trả về ảnh nền hợp lệ.");
    return createImageBitmap(blob);
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
      const output = await compositeImage(backgroundBitmap, person);

      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(output);
      el.resultImage.src = resultUrl;
      el.resultImage.hidden = false;
      el.resultBadge.hidden = false;
      el.resultControls.hidden = false;
      el.processingPanel.hidden = true;
      notice("Ảnh đã hoàn thành. Bạn có thể tải ảnh về điện thoại.", "ready");
    } catch (err) {
      el.processingPanel.hidden = true;
      el.startControls.hidden = false;
      el.cameraPlaceholder.hidden = false;
      notice("Chưa hoàn tất xử lý ảnh.", "error");
      showError(err instanceof Error ? err.message : "Có lỗi khi xử lý ảnh. Vui lòng thử lại.");
      await checkService();
    } finally {
      if (backgroundBitmap && typeof backgroundBitmap.close === "function") backgroundBitmap.close();
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
