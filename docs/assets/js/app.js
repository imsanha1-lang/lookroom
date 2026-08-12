(() => {
  const state = {
    styleId: null,
    bgColor: "#F4F1EC",
    file: null,
    apiBase: "",
    online: false,
  };

  const styleCards = [...document.querySelectorAll(".style-card")];
  const swatches = [...document.querySelectorAll(".swatch[data-color]")];
  const customColor = document.getElementById("customColor");
  const colorValue = document.getElementById("colorValue");
  const uploadZone = document.getElementById("uploadZone");
  const selfieInput = document.getElementById("selfieInput");
  const uploadInner = document.getElementById("uploadInner");
  const selfiePreview = document.getElementById("selfiePreview");
  const generateBtn = document.getElementById("generateBtn");
  const statusText = document.getElementById("statusText");
  const resultPanel = document.getElementById("resultPanel");
  const resultImage = document.getElementById("resultImage");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const connStatus = document.getElementById("connStatus");

  function setStatus(msg, kind = "") {
    statusText.textContent = msg || "";
    statusText.className = "status" + (kind ? ` ${kind}` : "");
  }

  function setConn(msg, kind = "") {
    if (!connStatus) return;
    connStatus.textContent = msg;
    connStatus.className = "conn" + (kind ? ` ${kind}` : "");
  }

  function apiUrl(path) {
    const base = (state.apiBase || "").replace(/\/$/, "");
    if (!base) return path;
    return base + path;
  }

  function refreshReady() {
    generateBtn.disabled = !(state.styleId && state.bgColor && state.file && state.online);
  }

  function selectStyle(card) {
    styleCards.forEach((c) => c.setAttribute("aria-selected", "false"));
    card.setAttribute("aria-selected", "true");
    state.styleId = card.dataset.styleId;
    refreshReady();
  }

  function setColor(hex, fromCustom = false) {
    state.bgColor = hex.toUpperCase();
    colorValue.textContent = state.bgColor;
    document.documentElement.style.setProperty("--selected-color", state.bgColor);
    swatches.forEach((s) => {
      s.setAttribute(
        "aria-selected",
        s.dataset.color.toUpperCase() === state.bgColor ? "true" : "false"
      );
    });
    if (!fromCustom) customColor.value = state.bgColor;
    refreshReady();
  }

  function setFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setStatus("이미지 파일만 업로드할 수 있어요.", "error");
      return;
    }
    state.file = file;
    const url = URL.createObjectURL(file);
    selfiePreview.src = url;
    selfiePreview.hidden = false;
    uploadInner.hidden = true;
    setStatus("");
    refreshReady();
  }

  async function resolveApiBase() {
    if (typeof window.LOOKROOM_API_BASE === "string" && window.LOOKROOM_API_BASE) {
      return window.LOOKROOM_API_BASE.replace(/\/$/, "");
    }
    const candidates = ["./data/api-base.json", "/data/api-base.json"];
    for (const path of candidates) {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.api_base) return String(data.api_base).replace(/\/$/, "");
      } catch (_) {
        /* try next */
      }
    }
    return "";
  }

  async function checkHealth() {
    try {
      const res = await fetch(apiUrl("/api/health"), { cache: "no-store" });
      const data = await res.json();
      state.online = !!(res.ok && data.ok);
      if (state.online) {
        setConn(state.apiBase ? "생성 PC 연결됨" : "로컬 연결됨", "ok");
      } else {
        setConn("생성 PC 미연결", "bad");
      }
    } catch (_) {
      state.online = false;
      setConn(
        state.apiBase
          ? "생성 PC 미연결 · start_online.bat 실행 필요"
          : "서버 연결 실패",
        "bad"
      );
    }
    refreshReady();
  }

  styleCards.forEach((card) => {
    card.addEventListener("click", () => selectStyle(card));
  });

  swatches.forEach((s) => {
    s.addEventListener("click", () => setColor(s.dataset.color));
  });

  customColor.addEventListener("input", () => setColor(customColor.value, true));

  selfieInput.addEventListener("change", () => {
    const file = selfieInput.files && selfieInput.files[0];
    if (file) setFile(file);
  });

  ["dragenter", "dragover"].forEach((ev) => {
    uploadZone.addEventListener(ev, (e) => {
      e.preventDefault();
      uploadZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    uploadZone.addEventListener(ev, (e) => {
      e.preventDefault();
      uploadZone.classList.remove("dragover");
    });
  });
  uploadZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  generateBtn.addEventListener("click", async () => {
    if (generateBtn.disabled) return;
    if (!state.online) {
      setStatus("생성 PC가 연결되어 있지 않습니다. start_online.bat 을 실행하세요.", "error");
      return;
    }

    const form = new FormData();
    form.append("style_id", state.styleId);
    form.append("bg_color", state.bgColor);
    form.append("selfie", state.file);

    generateBtn.disabled = true;
    setStatus("스튜디오 프로필 생성 중… 보통 20~60초 걸려요.", "busy");
    resultPanel.hidden = true;

    try {
      const res = await fetch(apiUrl("/api/generate"), { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "생성에 실패했습니다.");
      }
      resultImage.src = data.image_url + (data.image_url.includes("?") ? "&" : "?") + "t=" + Date.now();
      downloadBtn.href = data.download_url;
      resultPanel.hidden = false;
      setStatus("완성됐어요.");
      resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setStatus(err.message || "오류가 발생했습니다.", "error");
    } finally {
      refreshReady();
    }
  });

  resetBtn.addEventListener("click", () => {
    resultPanel.hidden = true;
    setStatus("");
    document.getElementById("studio").scrollIntoView({ behavior: "smooth" });
  });

  if (styleCards[0]) selectStyle(styleCards[0]);
  setColor("#F4F1EC");

  (async () => {
    state.apiBase = await resolveApiBase();
    await checkHealth();
    setInterval(checkHealth, 20000);
  })();
})();
