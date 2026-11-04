(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = {
    consentScreen: $("consentScreen"),
    consentCheck: $("consentCheck"),
    agreeButton: $("agreeButton"),
    cameraScreen: $("cameraScreen"),
    cameraVideo: $("cameraVideo"),
    cameraLensLabel: $("cameraLensLabel"),
    cameraBackBtn: $("cameraBackBtn"),
    switchBtn: $("switchBtn"),
    captureBtn: $("captureBtn"),
    nativeCaptureControls: $("nativeCaptureControls"),
    nativeCaptureBtn: $("nativeCaptureBtn"),
    nativeCameraInput: $("nativeCameraInput"),
    processingScreen: $("processingScreen"),
    processingTitle: $("processingTitle"),
    processingMessage: $("processingMessage"),
    progressFill: $("progressFill"),
    progressLabel: $("progressLabel"),
    progressPercent: $("progressPercent"),
    resultScreen: $("resultScreen"),
    resultImage: $("resultImage"),
    resultDescription: $("resultDescription"),
    downloadBtn: $("downloadBtn"),
    downloadHelp: $("downloadHelp"),
    retakeBtn: $("retakeBtn"),
    errorBox: $("errorBox")
  };

  let stream = null;
  let facingMode = "environment";
  let activeFacing = "environment";
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
      const data = await response.json();
      serviceReady = data.ready === true;
      el.agreeButton.disabled = !el.consentCheck.checked || !serviceReady;
      if (!serviceReady) {
        showError("Dịch vụ tạo phong cảnh đang tạm thời chưa sẵn sàng. Vui lòng thử lại sau.");
      }
    } catch (_) {
      serviceReady = false;
      el.agreeButton.disabled = true;
      showError("Chưa kết nối được dịch vụ. Vui lòng kiểm tra Internet rồi tải lại trang.");
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (el.cameraVideo) {
      el.cameraVideo.pause();
      el.cameraVideo.srcObject = null;
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function requestCamera(mode) {
    const media = navigator.mediaDevices;
    const dimensions = {
      width: { ideal: 1440 },
      height: { ideal: 1800 },
      aspectRatio: { ideal: 0.8 }
    };

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

    let cameras = [];
    try {
      const devices = await media.enumerateDevices();
      cameras = devices.filter(device => device.kind === "videoinput");
    } catch (_) {}

    if (!cameras.length) throw new Error("Trình duyệt không tìm thấy camera.");

    const isRear = mode === "environment";
    const pattern = isRear
      ? /(back|rear|environment|world|sau|arrière|trasera|背面|外側)/i
      : /(front|user|facetime|selfie|trước|前面|内側)/i;
    let candidates = cameras.filter(device => pattern.test(device.label || ""));
    if (!candidates.length) {
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
    throw lastError || new Error("Không mở được camera đã chọn.");
  }

  async function openCamera() {
    clearError();
    if (!consentAccepted) {
      showScreen("consent");
      showError("Vui lòng xác nhận quyền sử dụng ảnh trước khi mở camera.");
      return;
    }
    if (!serviceReady) {
      showScreen("consent");
      showError("Dịch vụ tạo phong cảnh đang tạm thời chưa sẵn sàng.");
      return;
    }
    if (stream && stream.getVideoTracks().some(track => track.readyState === "live")) {
      showScreen("camera");
      await el.cameraVideo.play().catch(() => {});
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showScreen("camera");
      el.nativeCaptureControls.hidden = false;
      showError("Trình duyệt không hỗ trợ camera trực tiếp. Bạn có thể mở camera hệ thống bên dưới.");
      return;
    }

    stopCamera();
    try {
      stream = await requestCamera(facingMode);
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings ? track.getSettings() : {};
      activeFacing = settings.facingMode || facingMode;
      el.cameraVideo.srcObject = stream;
      el.cameraVideo.classList.toggle("front-camera", activeFacing === "user");
      await el.cameraVideo.play();

      el.cameraLensLabel.textContent = activeFacing === "environment" ? "CAMERA SAU" : "CAMERA TRƯỚC";
      el.nativeCaptureControls.hidden = true;
      showScreen("camera");
    } catch (error) {
      stopCamera();
      showScreen("camera");
      el.nativeCaptureControls.hidden = false;
      const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
      showError(denied
        ? "Bạn chưa cấp quyền camera cho trình duyệt. Hãy cho phép quyền Camera trong cài đặt trình duyệt."
        : (error instanceof Error ? error.message : "Không mở được camera. Vui lòng thử lại."));
    }
  }

  function captureFrame() {
    const video = el.cameraVideo;
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Camera chưa sẵn sàng. Vui lòng đợi hình ảnh ổn định rồi chụp.");
    }

    // Capture exactly the portrait crop shown in the camera preview.
    const targetAspect = 4 / 5;
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const sourceAspect = sourceWidth / sourceHeight;
    let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;
    if (sourceAspect > targetAspect) {
      sw = sourceHeight * targetAspect;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / targetAspect;
      sy = (sourceHeight - sh) / 2;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (activeFacing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function createSegmenter() {
    if (segmenterPromise) return segmenterPromise;
    segmenterPromise = (async () => {
      if (typeof window.SelfieSegmentation !== "function") {
        throw new Error("Không tải được mô hình AI tách người. Hãy kiểm tra mạng và thử lại.");
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
      throw new Error("AI chưa nhận diện được người. Hãy đứng đủ sáng và chụp rõ người trong khung hình.");
    }

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
    maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);
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
        const confidence = mask[i] / 255;
        const t = Math.max(0, Math.min(1, (confidence - 0.13) / 0.67));
        const alpha = t * t * (3 - 2 * t);
        pixels[i + 3] = Math.round(pixels[i + 3] * alpha);

        if (alpha > 0.06) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        if (alpha > 0.88) opaqueCount++;
      }
    }

    if (maxX < minX || maxY < minY || opaqueCount < 1500) {
      throw new Error("AI chưa tách được chủ thể rõ ràng. Hãy chụp đủ sáng, không để người khác che khuất.");
    }

    ctx.putImageData(image, 0, 0);
    const margin = Math.round(Math.max(width, height) * 0.012);
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
      touchesBottom: maxY >= height * 0.965,
      aspect: trimmed.height / trimmed.width
    };
  }

  async function generateBackground() {
    const response = await fetch("/api/background", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ scene: "rice" })
    });
    if (!response.ok) {
      let message = "Chưa tải được phong cảnh nền. Vui lòng thử lại.";
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

  async function compositeImage(background, person) {
    const width = 1080;
    const height = 1350;
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const ctx = output.getContext("2d");

    // Use a photographic, full-bleed backdrop. Avoid artificial frames or stickers.
    drawCover(ctx, background, 0, 0, width, height);

    // A restrained color grade helps the foreground sit in the same atmosphere.
    const atmosphere = ctx.createLinearGradient(0, 0, 0, height);
    atmosphere.addColorStop(0, "rgba(255,249,235,0.035)");
    atmosphere.addColorStop(0.55, "rgba(235,242,226,0.015)");
    atmosphere.addColorStop(1, "rgba(20,39,25,0.07)");
    ctx.fillStyle = atmosphere;
    ctx.fillRect(0, 0, width, height);

    const subject = person.canvas;
    const fit = Math.min((width * 0.82) / subject.width, (height * 0.82) / subject.height);
    const subjectWidth = subject.width * fit;
    const subjectHeight = subject.height * fit;
    const x = (width - subjectWidth) / 2;
    const bottomMargin = person.touchesBottom ? 5 : 24;
    const y = height - subjectHeight - bottomMargin;
    const footY = Math.min(height - 18, y + subjectHeight * 0.985);

    // Soft contact shadow at ground level prevents a flat cut-and-paste appearance.
    ctx.save();
    ctx.filter = "blur(20px)";
    ctx.fillStyle = "rgba(17,28,18,0.28)";
    ctx.beginPath();
    ctx.ellipse(width / 2 + subjectWidth * 0.025, footY, Math.max(55, subjectWidth * 0.28), Math.max(10, subjectWidth * 0.035), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // A low-opacity cast shadow follows the person's silhouette.
    ctx.save();
    ctx.shadowColor = "rgba(12,27,18,0.27)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 7;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(subject, x, y, subjectWidth, subjectHeight);
    ctx.restore();

    // Gently harmonize contrast and saturation without recoloring skin or clothing.
    ctx.save();
    ctx.filter = "brightness(1.025) contrast(1.015) saturate(0.96)";
    ctx.drawImage(subject, x, y, subjectWidth, subjectHeight);
    ctx.restore();

    // Very light final tone curve; keep the photograph natural.
    const finish = ctx.createLinearGradient(0, 0, width, height);
    finish.addColorStop(0, "rgba(246,239,219,0.015)");
    finish.addColorStop(1, "rgba(7,25,15,0.045)");
    ctx.fillStyle = finish;
    ctx.fillRect(0, 0, width, height);

    return new Promise((resolve, reject) => {
      output.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Không xuất được ảnh hoàn chỉnh."));
      }, "image/jpeg", 0.95);
    });
  }

  async function processPhoto(sourceCanvas) {
    if (processing) return;
    processing = true;
    clearError();
    stopCamera();
    showScreen("processing");
    setProgress(12, "ĐANG PHÂN TÍCH ẢNH", "AI đang xử lý hình ảnh…", "Đang nhận diện chủ thể và tách người khỏi phông nền ngay trên điện thoại.");

    let background = null;
    try {
      const person = await makePersonCutout(sourceCanvas);
      setProgress(42, "ĐANG TẠO PHONG CẢNH", "Chủ thể đã được tách nền", "Đang chuẩn bị phong cảnh Tuyên Quang phù hợp để ghép ảnh.");
      background = await generateBackground();
      setProgress(76, "ĐANG PHỐI CẢNH & ÁNH SÁNG", "AI đang hoàn thiện bức ảnh…", "Đang căn chỉnh tỷ lệ, tạo bóng tiếp xúc và hòa sắc giữa người với phong cảnh.");
      const output = await compositeImage(background.bitmap, person);

      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultBlob = output;
      resultUrl = URL.createObjectURL(output);
      el.resultImage.src = resultUrl;
      el.resultDescription.textContent = background.source === "photo-fallback"
        ? "AI đã tách chủ thể và phối ghép với ảnh phong cảnh thật. Bạn có thể tải ảnh hoặc chụp lại."
        : "AI đã tách chủ thể, tạo phong cảnh và phối ghép hoàn chỉnh. Bạn có thể tải ảnh hoặc chụp lại.";
      el.downloadHelp.textContent = "Ảnh hoàn chỉnh được lưu trực tiếp về thiết bị, không lưu trên website.";
      setProgress(100, "HOÀN TẤT", "Bức ảnh đã sẵn sàng!", "Bạn có thể tải ảnh về hoặc chụp lại ngay.");
      await delay(350);
      showScreen("result");
    } catch (error) {
      showScreen("consent");
      showError(error instanceof Error ? error.message : "Có lỗi khi xử lý ảnh. Vui lòng thử lại.");
    } finally {
      if (background?.bitmap && typeof background.bitmap.close === "function") background.bitmap.close();
      processing = false;
      el.captureBtn.disabled = false;
    }
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

      // iOS Safari handles a generated image most reliably through its native
      // share sheet, where the user can choose "Save Image".
      if (isAppleMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Dấu ấn Áo xanh – Minh Khương" });
          el.downloadHelp.textContent = "Đã mở bảng chia sẻ. Chọn “Lưu hình ảnh” để lưu ảnh vào điện thoại.";
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
          // Fall through to the regular file download.
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
      try {
        window.open(resultUrl, "_blank", "noopener");
        el.downloadHelp.textContent = "Ảnh đã mở ở thẻ mới. Nhấn giữ ảnh rồi chọn “Lưu hình ảnh”.";
      } catch (_) {
        showError("Không mở được ảnh để tải. Hãy nhấn giữ ảnh xem trước và chọn lưu hình ảnh.");
      }
    } finally {
      el.downloadBtn.disabled = false;
      downloadBusy = false;
    }
  }

  function clearResult() {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    resultBlob = null;
    el.resultImage.removeAttribute("src");
  }

  el.consentCheck.addEventListener("change", () => {
    el.agreeButton.disabled = !el.consentCheck.checked || !serviceReady;
    clearError();
  });

  el.agreeButton.addEventListener("click", async () => {
    if (!el.consentCheck.checked) {
      showError("Vui lòng tích xác nhận trước khi mở camera.");
      return;
    }
    consentAccepted = true;
    await openCamera();
  });

  el.switchBtn.addEventListener("click", async () => {
    facingMode = facingMode === "environment" ? "user" : "environment";
    stopCamera();
    await delay(160);
    await openCamera();
  });

  el.cameraBackBtn.addEventListener("click", () => {
    stopCamera();
    consentAccepted = false;
    el.consentCheck.checked = false;
    el.agreeButton.disabled = !el.consentCheck.checked || !serviceReady;
    showScreen("consent");
    clearError();
  });

  el.captureBtn.addEventListener("click", async () => {
    try {
      const frame = captureFrame();
      el.captureBtn.disabled = true;
      await processPhoto(frame);
    } catch (error) {
      el.captureBtn.disabled = false;
      showError(error instanceof Error ? error.message : "Không chụp được ảnh.");
    }
  });

  el.nativeCaptureBtn.addEventListener("click", () => {
    clearError();
    el.nativeCameraInput.click();
  });

  el.nativeCameraInput.addEventListener("change", async () => {
    const file = el.nativeCameraInput.files?.[0];
    if (!file) return;
    try {
      let canvas;
      if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(file);
        canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const sourceAspect = bitmap.width / bitmap.height;
        const targetAspect = 4 / 5;
        let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
        if (sourceAspect > targetAspect) {
          sw = bitmap.height * targetAspect;
          sx = (bitmap.width - sw) / 2;
        } else {
          sh = bitmap.width / targetAspect;
          sy = (bitmap.height - sh) / 2;
        }
        ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
      } else {
        const imageUrl = URL.createObjectURL(file);
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = imageUrl;
        });
        canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1350;
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(imageUrl);
      }
      await processPhoto(canvas);
    } catch (error) {
      showScreen("camera");
      showError(error instanceof Error ? error.message : "Không đọc được ảnh từ camera điện thoại.");
    } finally {
      el.nativeCameraInput.value = "";
    }
  });

  el.downloadBtn.addEventListener("click", downloadResult);

  el.retakeBtn.addEventListener("click", async () => {
    clearResult();
    await openCamera();
  });

  window.addEventListener("pagehide", () => {
    stopCamera();
    clearResult();
  });

  checkService();
})();