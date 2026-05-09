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
          msg = data.error || msg;
          if (data.detail) msg += ` — ${data.detail}`;
          if (data.hint) msg += ` — ${data.hint}`;
        } else {
          const t = await res.text();
          if (t) msg += `: ${t.slice(0, 400)}`;
        }
      } catch {
        //
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
