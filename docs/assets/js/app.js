(() => {
  const state = {
    styleId: null,
    bgColor: null, // null = 레퍼런스 배경 유지
    file: null,
    apiBase: "",
    online: false,
  };

  const styleCards = [...document.querySelectorAll(".style-card")];
  const swatches = [...document.querySelectorAll(".swatch[data-color]")];
  const bgSkip = document.getElementById("bgSkip");
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
  const connBanner = document.getElementById("connBanner");

  function setStatus(msg, kind = "") {
    statusText.textContent = msg || "";
    statusText.className = "status" + (kind ? ` ${kind}` : "");
  }

  function setConn(msg, kind = "") {
    if (!connStatus) return;
    connStatus.textContent = msg;
    connStatus.className = "conn" + (kind ? ` ${kind}` : "");
    if (connBanner) connBanner.hidden = kind !== "bad";
  }

  function apiUrl(path) {
    const base = (state.apiBase || "").replace(/\/$/, "");
    if (!base) return path;
    return base + path;
  }

  function refreshReady() {
    generateBtn.disabled = !(state.styleId && state.file);
  }

  function selectStyle(card) {
    styleCards.forEach((c) => c.setAttribute("aria-selected", "false"));
    card.setAttribute("aria-selected", "true");
    state.styleId = card.dataset.styleId;
    refreshReady();
  }

  function clearColorSelection() {
    swatches.forEach((s) => s.setAttribute("aria-selected", "false"));
    if (bgSkip) bgSkip.setAttribute("aria-selected", "false");
  }

  function setSkipBg() {
    state.bgColor = null;
    clearColorSelection();
    if (bgSkip) bgSkip.setAttribute("aria-selected", "true");
    colorValue.textContent = "레퍼런스 유지";
    document.documentElement.style.setProperty("--selected-color", "transparent");
    refreshReady();
  }

  function setColor(hex, fromCustom = false) {
    state.bgColor = hex.toUpperCase();
    clearColorSelection();
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
    // 사이트 루트 기준 상대경로만 사용 (/data/... 는 github.io 루트로 가서 404)
    const bust = `t=${Date.now()}`;
    const path = `./data/api-base.json?${bust}`;
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) return "";
      const data = await res.json();
      if (data && data.api_base) return String(data.api_base).replace(/\/$/, "");
    } catch (_) {
      /* empty */
    }
    return "";
  }

  let healthTimer = null;

  function scheduleHealth(ms) {
    if (healthTimer) clearInterval(healthTimer);
    healthTimer = setInterval(checkHealth, ms);
  }

  async function checkHealth() {
    // 매 주기 api-base 를 다시 읽어 죽은 주소에 고정되지 않게 한다.
    const latest = await resolveApiBase();
    state.apiBase = latest || "";

    if (!state.apiBase) {
      state.online = false;
      setConn("생성 PC 대기 중 · PC가 켜지면 자동 연결됩니다", "bad");
      scheduleHealth(5000);
      refreshReady();
      return;
    }

    try {
      const res = await fetch(apiUrl("/api/health"), { cache: "no-store", mode: "cors" });
      const data = await res.json();
      state.online = !!(res.ok && data.ok);
      if (state.online) {
        setConn("생성 PC 연결됨", "ok");
        scheduleHealth(20000);
      } else {
        state.apiBase = "";
        setConn("생성 PC 미연결 · 잠시 후 자동 재시도", "bad");
        scheduleHealth(5000);
      }
    } catch (_) {
      state.online = false;
      state.apiBase = "";
      setConn("생성 PC 연결 중… PC가 켜져 있으면 곧 연결됩니다", "bad");
      scheduleHealth(5000);
    }
    refreshReady();
  }

  styleCards.forEach((card) => {
    card.addEventListener("click", () => selectStyle(card));
  });

  if (bgSkip) {
    bgSkip.addEventListener("click", () => setSkipBg());
  }

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
      setStatus("생성 PC가 연결되어 있지 않습니다. PC 전원과 온라인 서버 실행을 확인하세요.", "error");
      return;
    }

    const form = new FormData();
    form.append("style_id", state.styleId);
    form.append("bg_color", state.bgColor || "reference");
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
      const msg = String(err && err.message ? err.message : err);
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        state.online = false;
        state.apiBase = "";
        setConn("생성 PC 연결 중… 주소 갱신 후 다시 시도합니다", "bad");
        setStatus("생성 PC 연결이 끊겼습니다. 잠시 후 다시 눌러 주세요.", "error");
        scheduleHealth(3000);
      } else {
        setStatus(msg || "오류가 발생했습니다.", "error");
      }
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
  setSkipBg();

  (async () => {
    state.apiBase = await resolveApiBase();
    await checkHealth();
    scheduleHealth(state.online ? 20000 : 5000);
  })();
})();
