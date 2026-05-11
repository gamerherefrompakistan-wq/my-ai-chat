const promptEl     = document.getElementById("prompt");
const widthEl      = document.getElementById("width");
const heightEl     = document.getElementById("height");
const generateBtn  = document.getElementById("generateBtn");
const downloadBtn  = document.getElementById("downloadBtn");
const copyBtn      = document.getElementById("copyBtn");
const regenerateBtn= document.getElementById("regenerateBtn");
const statusDot    = document.getElementById("statusDot");
const statusText   = document.getElementById("statusText");
const outputEl     = document.getElementById("output");
const imageUrlEl   = document.getElementById("imageUrl");
const idleState    = document.getElementById("idleState");
const loadingState = document.getElementById("loadingState");
const imageWrap    = document.getElementById("imageWrap");
const loadingTitle = document.getElementById("loadingTitle");
const loadingMsg   = document.getElementById("loadingMsg");
const charCount    = document.getElementById("charCount");

let currentStyle = "";
let lastPrompt   = "";
let msgInterval  = null;

// ── Char counter ──
promptEl.addEventListener("input", () => {
  charCount.textContent = promptEl.value.length;
});

// ── Style buttons ──
document.querySelectorAll(".style-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".style-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentStyle = btn.dataset.style;
  });
});

// ── Preset buttons ──
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    widthEl.value  = btn.dataset.w;
    heightEl.value = btn.dataset.h;
  });
});

// ── Urdu/Roman Urdu dict ──
const dict = {
  "cycle":"bicycle","sawar":"riding","larki":"girl","larka":"boy",
  "ghar":"house","gaari":"car","pani":"water","aasman":"sky",
  "phool":"flower","darya":"river","pahar":"mountain","jungle":"forest",
  "raat":"night","din":"day","suraj":"sun","chand":"moon",
  "billi":"cat","kutta":"dog","ghora":"horse","chirya":"bird",
  "admi":"man","aurat":"woman","bacha":"child","dost":"friend",
  "khana":"food","chai":"tea","kitab":"book","shahar":"city",
  "gaon":"village","sadak":"road","banao":"","bnao":"","kro":"","karo":"","generate":""
};

function preparePrompt(raw) {
  let p = raw.toLowerCase();
  Object.keys(dict).forEach(k => {
    p = p.replace(new RegExp(`\\b${k}\\b`, "gi"), dict[k]);
  });
  p = p.replace(/\s+/g, " ").trim();
  if (!p || p.length < 3) p = raw;
  if (currentStyle) p += ", " + currentStyle;
  p += ", high quality, HD, detailed, 4k";
  return p;
}

function buildUrl(prompt) {
  const seed = Math.floor(Math.random() * 99999999);
  const w    = Number(widthEl.value)  || 1024;
  const h    = Number(heightEl.value) || 1024;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true`;
}

// ── Loading messages ──
const loadingMessages = [
  ["Image Generate Ho Rahi Hai...", "AI har pixel carefully bana raha hai"],
  ["Fine Details Add Ho Rahe Hain...", "Thora aur wait karo, almost ready"],
  ["Colors Finalize Ho Rahe Hain...", "Tera masterpiece tayar hone wala hai"],
  ["Final Touches...", "Bas kuch seconds aur..."],
];

function startLoadingMessages() {
  let i = 0;
  msgInterval = setInterval(() => {
    i = (i + 1) % loadingMessages.length;
    loadingTitle.textContent = loadingMessages[i][0];
    loadingMsg.textContent   = loadingMessages[i][1];
  }, 7000);
}

function stopLoadingMessages() {
  if (msgInterval) { clearInterval(msgInterval); msgInterval = null; }
}

// ── State helpers ──
function setIdle(msg) {
  idleState.style.display    = "";
  loadingState.style.display = "none";
  imageWrap.style.display    = "none";
  statusDot.className = "status-dot idle";
  statusText.textContent = msg || "Tayyar hai — prompt likho aur generate karo";
}

function setLoading() {
  idleState.style.display    = "none";
  loadingState.style.display = "";
  imageWrap.style.display    = "none";
  statusDot.className = "status-dot loading";
  statusText.textContent = "Image generate ho rahi hai...";
  // Reset progress bar
  const fill = document.getElementById("progressFill");
  fill.style.animation = "none";
  fill.offsetHeight;
  fill.style.animation = "progressAnim 40s ease-in-out forwards";
  // Reset loading text
  loadingTitle.textContent = loadingMessages[0][0];
  loadingMsg.textContent   = loadingMessages[0][1];
  startLoadingMessages();
}

function setSuccess() {
  idleState.style.display    = "none";
  loadingState.style.display = "none";
  imageWrap.style.display    = "";
  statusDot.className = "status-dot success";
  statusText.textContent = "Image ready hai ✅ Download ya copy karo";
  stopLoadingMessages();
  downloadBtn.disabled  = false;
  copyBtn.disabled      = false;
  regenerateBtn.disabled= false;
}

function setError(msg) {
  idleState.style.display    = "";
  loadingState.style.display = "none";
  imageWrap.style.display    = "none";
  statusDot.className = "status-dot error";
  statusText.textContent = msg || "Error aa gaya — dobara try karo";
  stopLoadingMessages();
  generateBtn.disabled = false;
  document.querySelector(".btn-content").style.display = "flex";
  document.querySelector(".btn-loading").style.display = "none";
}

// ── Generate ──
function doGenerate(rawPrompt) {
  if (!rawPrompt) { promptEl.focus(); return; }
  lastPrompt = rawPrompt;

  const finalPrompt = preparePrompt(rawPrompt);
  const url = buildUrl(finalPrompt);
  imageUrlEl.value = url;

  generateBtn.disabled = true;
  downloadBtn.disabled = true;
  copyBtn.disabled     = true;
  regenerateBtn.disabled = true;

  document.querySelector(".btn-content").style.display = "none";
  document.querySelector(".btn-loading").style.display = "flex";

  setLoading();

  let tries = 0;
  const maxTries = 3;

  function tryLoad() {
    const img = document.getElementById("output");

    img.onload = () => {
      generateBtn.disabled = false;
      document.querySelector(".btn-content").style.display = "flex";
      document.querySelector(".btn-loading").style.display = "none";
      setSuccess();
    };

    img.onerror = () => {
      tries++;
      if (tries < maxTries) {
        loadingTitle.textContent = `Retry ${tries}/${maxTries}...`;
        loadingMsg.textContent   = "Dobara koshish ho rahi hai...";
        const newUrl = buildUrl(finalPrompt);
        imageUrlEl.value = newUrl;
        setTimeout(() => { img.src = newUrl; }, 3000);
      } else {
        setError("Image load nahi hui — dobara Generate karo");
        generateBtn.disabled = false;
        document.querySelector(".btn-content").style.display = "flex";
        document.querySelector(".btn-loading").style.display = "none";
      }
    };

    img.src = url;
  }

  tryLoad();
}

generateBtn.addEventListener("click", () => doGenerate(promptEl.value.trim()));
regenerateBtn.addEventListener("click", () => doGenerate(lastPrompt || promptEl.value.trim()));

// Ctrl+Enter shortcut
promptEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.ctrlKey) doGenerate(promptEl.value.trim());
});

// Copy URL
copyBtn.addEventListener("click", async () => {
  if (!imageUrlEl.value) return;
  await navigator.clipboard.writeText(imageUrlEl.value);
  const orig = copyBtn.innerHTML;
  copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
  setTimeout(() => { copyBtn.innerHTML = orig; }, 2000);
});

// Download
downloadBtn.addEventListener("click", () => {
  if (!outputEl.src) return;
  fetch(outputEl.src)
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `my-ai-image-${Date.now()}.png`;
      a.click();
    })
    .catch(() => window.open(outputEl.src, "_blank"));
});

// Init
setIdle();
