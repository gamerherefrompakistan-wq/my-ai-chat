const promptEl = document.getElementById("prompt");
const durationEl = document.getElementById("duration");
const aspectEl = document.getElementById("aspect");
const modelEl = document.getElementById("model");
const audioEl = document.getElementById("audio");
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");

let lastBlobUrl = null;

function revokeLastUrl() {
  if (lastBlobUrl) {
    URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = null;
  }
}

generateBtn.addEventListener("click", async () => {
  const prompt = promptEl.value.trim();
  if (prompt.length < 4) {
    statusEl.textContent = "Thora aur detail wala prompt likho (kam az kam 4 characters).";
    return;
  }

  revokeLastUrl();
  outputEl.src = "";
  outputEl.style.display = "none";
  downloadBtn.disabled = true;

  generateBtn.disabled = true;
  statusEl.textContent = "Video generate ho rahi hai... (1–3 minute bhi lag sakti hai)";
  generateBtn.textContent = "Generating...";

  try {
    const res = await fetch("/api/generate-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        duration: Number(durationEl.value) || 5,
        aspectRatio: aspectEl.value,
        model: modelEl.value,
        audio: Boolean(audioEl.checked)
      })
    });

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try {
        if (contentType.includes("application/json")) {
          const data = await res.json();
          const inner =
            data?.error?.message ||
            (typeof data.error === "string" ? data.error : null);
          msg = inner || data.error || msg;
          if (data.detail && !String(msg).includes(String(data.detail).slice(0, 40))) {
            msg += ` — ${data.detail}`;
          }
          if (data.hint) msg += ` — ${data.hint}`;
        } else {
          const t = await res.text();
          if (t) msg += `: ${t.slice(0, 400)}`;
        }
      } catch {
        //
      }
      if (/402|Insufficient balance|PAYMENT_REQUIRED|pollen/i.test(msg)) {
        msg += " Tip: page scroll karke Free mode — stock video links use karo (bina paise).";
      }
      statusEl.textContent = msg;
      return;
    }

    if (!contentType.includes("video")) {
      statusEl.textContent = "Unexpected response — server MP4 ka response nahi bhej raha.";
      return;
    }

    const blob = await res.blob();
    lastBlobUrl = URL.createObjectURL(blob);
    outputEl.src = lastBlobUrl;
    outputEl.style.display = "block";
    outputEl.play().catch(() => {});
    statusEl.textContent = "Video ready ✅ Chalayein / download kar lein.";
    downloadBtn.disabled = false;
  } catch (error) {
    statusEl.textContent = `Network error: ${error?.message || "Unknown"}`;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate video";
  }
});

downloadBtn.addEventListener("click", () => {
  if (!lastBlobUrl) return;
  const link = document.createElement("a");
  link.href = lastBlobUrl;
  link.download = `prompt-video-${Date.now()}.mp4`;
  document.body.appendChild(link);
  link.click();
  link.remove();
});

const freeKeywordsEl = document.getElementById("freeKeywords");
const freeLinksBtn = document.getElementById("freeLinksBtn");
const copyKeywordsBtn = document.getElementById("copyKeywordsBtn");
const freeResultsEl = document.getElementById("freeResults");
const freeQueryOutEl = document.getElementById("freeQueryOut");
const freeLinkListEl = document.getElementById("freeLinkList");

function buildStockSearchFromPrompt(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/[,.\n;|]+/g, " ")
    .replace(/\s+/g, " ");
  if (!s) return "";
  const boring = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "with",
    "from",
    "into",
    "over",
    "shot",
    "video",
    "footage",
    "clip"
  ]);
  const words = s
    .toLowerCase()
    .split(" ")
    .filter((w) => w.length > 1 && !boring.has(w));
  const picked = (words.length ? words : s.toLowerCase().split(" ")).filter(Boolean).slice(0, 10);
  return picked.join(" ").trim() || "nature";
}

function stockLinksForQuery(q) {
  const enc = encodeURIComponent(q);
  return [
    { label: "Pexels (free stock videos)", href: `https://www.pexels.com/search/videos/${enc}/` },
    { label: "Pixabay (free stock videos)", href: `https://pixabay.com/videos/search/${enc}/` },
    { label: "Coverr (free stock videos)", href: `https://coverr.co/search?query=${enc}` },
    { label: "Videezy (search)", href: `https://www.videezy.com/search?query=${enc}` }
  ];
}

freeLinksBtn.addEventListener("click", () => {
  const manual = freeKeywordsEl.value.trim();
  const fromPrompt = buildStockSearchFromPrompt(promptEl.value);
  const q = manual || fromPrompt;
  if (!q) {
    statusEl.textContent = "Pehle uper video prompt likho, ya neeche English keywords likho.";
    return;
  }

  freeQueryOutEl.textContent = q;
  freeLinkListEl.innerHTML = "";
  for (const item of stockLinksForQuery(q)) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = item.label;
    li.appendChild(a);
    freeLinkListEl.appendChild(li);
  }
  freeResultsEl.classList.remove("is-hidden");
  statusEl.textContent =
    "Free links ready — neeche list me click karo. Clip download karke CapCut me use karo.";
});

copyKeywordsBtn.addEventListener("click", async () => {
  const manual = freeKeywordsEl.value.trim();
  const fromPrompt = buildStockSearchFromPrompt(promptEl.value);
  const q = manual || fromPrompt;
  if (!q) return;
  await navigator.clipboard.writeText(q);
  copyKeywordsBtn.textContent = "Copied";
  setTimeout(() => {
    copyKeywordsBtn.textContent = "Copy keywords";
  }, 1200);
});
