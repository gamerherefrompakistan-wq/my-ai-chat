// Elements
const promptEl    = document.getElementById("prompt");
const durationEl  = document.getElementById("duration");
const audioEl     = document.getElementById("audio");
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusEl    = document.getElementById("status");
const statusText  = document.getElementById("statusText");
const statusDot   = document.getElementById("statusDot");
const outputEl    = document.getElementById("output");
const idleState   = document.getElementById("idleState");
const loadingState= document.getElementById("loadingState");
const charCount   = document.getElementById("charCount");
const loadingTitle= document.getElementById("loadingTitle");

let lastBlobUrl   = null;
let selectedRatio = "16:9";

// ── Char counter ──
promptEl.addEventListener("input", () => {
  charCount.textContent = promptEl.value.length;
});

// ── Duration +/- buttons ──
document.getElementById("durMinus").addEventListener("click", () => {
  const v = parseInt(durationEl.value) || 5;
  if (v > 1) durationEl.value = v - 1;
});

document.getElementById("durPlus").addEventListener("click", () => {
  const v = parseInt(durationEl.value) || 5;
  if (v < 10) durationEl.value = v + 1;
});

// ── Ratio buttons ──
document.querySelectorAll(".ratio-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".ratio-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedRatio = btn.dataset.value;
  });
});

// ── State helpers ──
function setIdle(msg) {
  idleState.style.display = "";
  loadingState.style.display = "none";
  outputEl.style.display = "none";

  statusDot.className = "status-dot idle";
  statusText.textContent = msg || "Tayyar hai — prompt likho aur generate karo";
}

function setLoading(msg) {
  idleState.style.display = "none";
  loadingState.style.display = "";
  outputEl.style.display = "none";

  statusDot.className = "status-dot loading";
  statusText.textContent = msg || "Video generate ho rahi hai...";
  loadingTitle.textContent = "Video Generate Ho Rahi Hai...";
  statusEl.textContent = "AI model kaam kar raha hai, thora wait karo";
}

function setSuccess() {
  idleState.style.display = "none";
  loadingState.style.display = "none";
  outputEl.style.display = "block";

  statusDot.className = "status-dot success";
  statusText.textContent = "Video ready hai ✅";
}

function setError(msg) {
  idleState.style.display = "";
  loadingState.style.display = "none";
  outputEl.style.display = "none";

  statusDot.className = "status-dot error";
  statusText.textContent = msg || "Kuch error aa gaya";
}

// ── Loading messages ──
const loadingMessages = [
  "AI model video frames render kar raha hai...",
  "Thora aur wait karo, quality check ho raha hai...",
  "Almost ready, final processing chal rahi hai...",
  "Video assemble ho rahi hai...",
];

let msgInterval = null;

function startLoadingMessages() {
  let i = 0;

  msgInterval = setInterval(() => {
    i = (i + 1) % loadingMessages.length;
    statusEl.textContent = loadingMessages[i];
  }, 3000);
}

function stopLoadingMessages() {
  if (msgInterval) {
    clearInterval(msgInterval);
    msgInterval = null;
  }
}

// ── Revoke old blob ──
function revokeLastUrl() {
  if (lastBlobUrl) {
    URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = null;
  }
}

// ── Generate Video ──
generateBtn.addEventListener("click", async () => {

  const prompt = promptEl.value.trim();

  if (prompt.length < 4) {
    setError("Thora aur detail wala prompt likho (kam az kam 4 characters).");
    return;
  }

  revokeLastUrl();

  downloadBtn.disabled = true;
  generateBtn.disabled = true;

  // Button Loading UI
  document.querySelector(".btn-content").style.display = "none";
  document.querySelector(".btn-loading").style.display = "flex";

  setLoading();
  startLoadingMessages();

  try {

    const res = await fetch("/api/generate-video", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        prompt,
        duration: Number(durationEl.value) || 5,
        aspectRatio: selectedRatio,

        // ✅ FIXED MODEL
        model: "wan-fast",

        audio: Boolean(audioEl.checked)
      })
    });

    const contentType = res.headers.get("content-type") || "";

    // Error Response
    if (!res.ok) {

      let msg = `Error ${res.status}`;

      try {

        if (contentType.includes("application/json")) {

          const data = await res.json();

          msg = data.error || msg;

          if (data.detail) {
            msg += ` — ${data.detail}`;
          }

          if (data.hint) {
            msg += ` — ${data.hint}`;
          }

        } else {

          const t = await res.text();

          if (t) {
            msg += `: ${t.slice(0, 200)}`;
          }
        }

      } catch {}

      setError(msg);
      return;
    }

    // Not Video
    if (!contentType.includes("video")) {
      setError("Server MP4 response nahi bhej raha — API check karo.");
      return;
    }

    // Success
    const blob = await res.blob();

    lastBlobUrl = URL.createObjectURL(blob);

    outputEl.src = lastBlobUrl;

    setSuccess();

    outputEl.play().catch(() => {});

    downloadBtn.disabled = false;

  } catch (error) {

    setError(`Network error: ${error?.message || "Unknown"}`);

  } finally {

    generateBtn.disabled = false;

    document.querySelector(".btn-content").style.display = "flex";
    document.querySelector(".btn-loading").style.display = "none";

    stopLoadingMessages();
  }
});

// ── Download ──
downloadBtn.addEventListener("click", () => {

  if (!lastBlobUrl) return;

  const link = document.createElement("a");

  link.href = lastBlobUrl;

  link.download = `my-ai-video-${Date.now()}.mp4`;

  document.body.appendChild(link);

  link.click();

  link.remove();
});

// Init
setIdle();
