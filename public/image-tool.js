const promptEl = document.getElementById("prompt");
const widthEl = document.getElementById("width");
const heightEl = document.getElementById("height");
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const statusEl = document.getElementById("status");
const imageUrlEl = document.getElementById("imageUrl");
const outputEl = document.getElementById("output");

function buildUrl(prompt, width, height) {
  const cleanPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 99999999); // Har baar naya random seed
  return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;
}

function buildFallbackUrl(prompt, width, height) {
  const text = encodeURIComponent(prompt.slice(0, 80));
  return `https://placehold.co/${width}x${height}/0f172a/e2e8f0?text=${text}`;
}

let retryCount = 0;
const MAX_RETRIES = 3;

function loadImageWithRetry(url, fallbackUrl) {
  statusEl.textContent = retryCount > 0 
    ? `Retry ${retryCount}/${MAX_RETRIES}... thoda wait karo ⏳` 
    : "Image generate ho rahi hai... ⏳";

  outputEl.style.display = "none";

  outputEl.onload = () => {
    statusEl.innerHTML = "Image ready ✅";
    outputEl.style.display = "block";
    retryCount = 0;
  };

  outputEl.onerror = () => {
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      // Naya seed ke saath dobara try
      const newUrl = buildUrl(
        decodeURIComponent(url.split("/prompt/")[1].split("?")[0]),
        widthEl.value,
        heightEl.value
      );
      imageUrlEl.value = newUrl;
      setTimeout(() => loadImageWithRetry(newUrl, fallbackUrl), 2000);
    } else {
      statusEl.textContent = "Image load nahi hui — dobara Generate karo.";
      retryCount = 0;
    }
  };

  outputEl.src = url;
}

generateBtn.addEventListener("click", () => {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    statusEl.textContent = "Pehle prompt likho.";
    return;
  }

  const width = Number(widthEl.value) || 1024;
  const height = Number(heightEl.value) || 1024;

  retryCount = 0;
  const url = buildUrl(prompt, width, height);
  const fallback = buildFallbackUrl(prompt, width, height);

  imageUrlEl.value = url;
  loadImageWithRetry(url, fallback);
});

copyBtn.addEventListener("click", async () => {
  if (!imageUrlEl.value) {
    statusEl.textContent = "Pehle image generate karo.";
    return;
  }
  await navigator.clipboard.writeText(imageUrlEl.value);
  statusEl.textContent = "URL copy ho gaya! ✅";
});

downloadBtn.addEventListener("click", () => {
  if (!outputEl.src || outputEl.style.display === "none") {
    statusEl.textContent = "Pehle image generate karo.";
    return;
  }

  // Proxy se download karo taake CORS issue na aaye
  fetch(outputEl.src)
    .then(res => res.blob())
    .then(blob => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "ai-generated-image.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      statusEl.textContent = "Download shuru ho gaya! ✅";
    })
    .catch(() => {
      // Fallback
      const link = document.createElement("a");
      link.href = outputEl.src;
      link.target = "_blank";
      link.download = "ai-generated-image.png";
      link.click();
    });
});

