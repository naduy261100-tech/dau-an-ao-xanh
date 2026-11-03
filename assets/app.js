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
  let turnstileSiteKey = null;
  let turnstileWidgetId = null;
  let turnstileScriptPromise = null;

  function notice(message, state) {
    el.serviceNote.className = "service-note" + (state ? " " + state : "");
    el.serviceText.textContent = message;
  }

  function error(message) {
    el.errorBox.textContent = message;
    el.errorBox.hidden = false;
  }

  function clearError() {
    el.errorBox.textContent = "";
    el.errorBox.hidden = true;
  }

  function updateStartState() {
    el.startBtn.disabled = mode === "locked" || !el.consentCheck.checked || processing;
  }

  function applyMode(data) {
    mode = data.mode || "locked";

    if (mode === "adult") {
      el.consentDescription.textContent = "Ảnh sẽ được gửi bảo mật tới PhotoRoom để tách chủ thể, tạo phong cảnh AI và trả kết quả thẳng về điện thoại. Website không lưu ảnh vào thư viện hoặc cơ sở dữ liệu.";
      el.consentWarning.textContent = "ĐANG Ở CHẾ ĐỘ THỬ NGHIỆM: chỉ sử dụng ảnh của chính người trưởng thành. Không dùng ảnh học sinh.";
      el.consentLabel.textContent = "Tôi từ đủ 18 tuổi, đây là ảnh của chính tôi và tôi đồng ý gửi ảnh để xử lý check-in.";
    } else if (mode === "school") {
      el.consentDescription.textContent = "Ảnh được gửi bảo mật tới PhotoRoom để tạo ảnh check-in rồi trả trực tiếp về điện thoại. Website không lưu ảnh vào thư viện hoặc cơ sở dữ liệu.";
      el.consentWarning.textContent = "Ảnh học sinh chỉ được dùng khi nhà trường đã hoàn tất quy trình thông báo và có chấp thuận hợp lệ của người đại diện theo pháp luật; cần tôn trọng ý kiến của học sinh.";
      el.consentLabel.textContent = "Tôi đã đọc thông tin và là chủ thể ảnh hoặc có quyền đại diện hợp lệ để đồng ý xử lý ảnh này.";
    } else {
      el.consentWarning.textContent = "Dịch vụ đang khóa cho đến khi quản trị viên cấu hình API và xác nhận các điều kiện bảo vệ dữ liệu.";
      el.consentLabel.textContent = "Tôi đã đọc thông tin xử lý ảnh.";
    }

    updateStartState();
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    el.cameraVideo.srcObject = null;
  }

  async function checkService() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const data = await response.json();
      applyMode(data);
      turnstileSiteKey = data.turnstileSiteKey || null;

      if (data.ready === true && mode === "adult") {
        notice("Bản thử nghiệm đã sẵn sàng. Chỉ chụp ảnh của chính người trưởng thành; ảnh sẽ được xử lý trực tuyến.", "ready");
      } else if (data.ready === true && mode === "school") {
        notice("Dịch vụ AI của nhà trường đã sẵn sàng. Vui lòng đọc thông tin xử lý ảnh trước khi chụp.", "ready");
      } else {
        mode = "locked";
        updateStartState();
        notice("Website đã mở nhưng dịch vụ AI chưa được kích hoạt. Quản trị viên cần cấu hình khóa API và các xác nhận quyền riêng tư.", "error");
      }
    } catch (_) {
      mode = "locked";
      updateStartState();
      notice("Chưa kết nối được máy chủ AI. Vui lòng thử lại sau khi website được xuất bản đầy đủ.", "error");
    }
  }

  async function openCamera() {
    clearError();
    if (mode === "locked") {
      error("Dịch vụ AI chưa được kích hoạt. Vui lòng liên hệ quản trị viên.");
      return;
    }
    if (!el.consentCheck.checked) {
      error("Vui lòng đọc thông tin xử lý ảnh và xác nhận trước khi bật camera.");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      error("Trình duyệt chưa hỗ trợ camera trực tiếp. Hãy mở đường link bằng Safari hoặc Chrome phiên bản mới.");
      return;
    }

    stopCamera();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1600 },
          height: { ideal: 2000 }
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
      error(denied
        ? "Bạn chưa cho phép trình duyệt truy cập camera. Hãy bật quyền Camera trong cài đặt trình duyệt rồi thử lại."
        : "Không mở được camera. Hãy kiểm tra camera và thử lại.");
    }
  }

  function blobFromCanvas(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Không tạo được ảnh từ camera.")), "image/jpeg", 0.9);
    });
  }

  async function takePhoto() {
    const video = el.cameraVideo;
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Camera chưa sẵn sàng. Vui lòng chờ một chút rồi chụp lại.");
    }

    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Chỉ lấy mức sáng tổng quát để tự chọn một trong hai phong cảnh; không nhận diện danh tính.
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
    brightness = brightness / (pixels.length / 4);

    return {
      blob: await blobFromCanvas(canvas),
      profile: brightness > 135 ? "bright" : "soft"
    };
  }

  async function loadTurnstile() {
    if (window.turnstile) return;
    if (!turnstileScriptPromise) {
      turnstileScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Không tải được lớp xác thực bảo mật. Vui lòng thử lại."));
        document.head.appendChild(script);
      });
    }
    await turnstileScriptPromise;
  }

  async function getTurnstileToken() {
    if (!turnstileSiteKey) throw new Error("Máy chủ chưa cấu hình xác thực bảo mật.");
    await loadTurnstile();

    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (callback, value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        callback(value);
      };
      const timer = setTimeout(() => finish(reject, new Error("Xác thực bị quá thời gian. Vui lòng thử lại.")), 30000);

      try {
        if (turnstileWidgetId === null) {
          turnstileWidgetId = window.turnstile.render(el.turnstileContainer, {
            sitekey: turnstileSiteKey,
            size: "invisible",
            execution: "execute",
            appearance: "interaction-only",
            callback: token => finish(resolve, token),
            "error-callback": () => finish(reject, new Error("Không xác thực được. Vui lòng thử lại.")),
            "expired-callback": () => finish(reject, new Error("Mã xác thực đã hết hạn. Vui lòng thử lại."))
          });
        } else {
          window.turnstile.reset(turnstileWidgetId);
        }
        window.turnstile.execute(turnstileWidgetId);
      } catch (_) {
        finish(reject, new Error("Không khởi động được xác thực bảo mật."));
      }
    });
  }

  async function processPhoto(photo, profile) {
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
    el.processingTitle.textContent = "AI đang tạo phong cảnh cho bạn…";
    notice("Đang gửi ảnh qua kết nối bảo mật để xử lý AI.", "");

    try {
      const body = new FormData();
      body.append("photo", photo, "dau-an-ao-xanh.jpg");
      body.append("photoProfile", profile);
      body.append("consent", mode);
      const turnstileToken = await getTurnstileToken();
      body.append("cf-turnstile-response", turnstileToken);

      const response = await fetch("/api/process", {
        method: "POST",
        body,
        cache: "no-store"
      });
      const type = response.headers.get("content-type") || "";

      if (!response.ok) {
        let message = "AI chưa xử lý được ảnh này. Hãy chụp đủ sáng, rõ người và thử lại.";
        if (type.includes("application/json")) {
          const payload = await response.json();
          if (payload && typeof payload.message === "string") message = payload.message;
        }
        throw new Error(message);
      }
      if (!type.startsWith("image/")) throw new Error("Máy chủ không trả về ảnh hợp lệ.");

      const output = await response.blob();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(output);
      el.resultImage.src = resultUrl;
      el.resultImage.hidden = false;
      el.resultBadge.hidden = false;
      el.resultControls.hidden = false;
      el.processingPanel.hidden = true;
      notice("Ảnh đã được AI xử lý. Bạn có thể tải về điện thoại.", "ready");
    } catch (err) {
      el.processingPanel.hidden = true;
      el.startControls.hidden = false;
      el.cameraPlaceholder.hidden = false;
      notice("Chưa hoàn tất xử lý ảnh.", "error");
      error(err instanceof Error ? err.message : "Có lỗi khi xử lý ảnh. Vui lòng thử lại.");
      await checkService();
    } finally {
      processing = false;
      el.captureBtn.disabled = false;
      updateStartState();
    }
  }

  el.consentCheck.addEventListener("change", updateStartState);
  el.startBtn.addEventListener("click", openCamera);

  el.captureBtn.addEventListener("click", async () => {
    try {
      const photo = await takePhoto();
      await processPhoto(photo.blob, photo.profile);
    } catch (err) {
      error(err instanceof Error ? err.message : "Không chụp được ảnh.");
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
