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
  return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${Date.now()}&nologo=true`;
}

function buildFallbackUrl(prompt, width, height) {
  const text = encodeURIComponent(prompt.slice(0, 80));
  return `https://placehold.co/${width}x${height}/0f172a/e2e8f0?text=${text}`;
}

function loadImageWithRetry(urls, index = 0) {
  if (index >= urls.length) {
    statusEl.textContent = "Image load fail hui, dobara try karo.";
    outputEl.style.display = "none";
    return;
  }

  outputEl.onload = () => {
    statusEl.textContent = index === urls.length - 1 ? "Fallback image ready." : "Image ready ✅";
    outputEl.style.display = "block";
  };

  outputEl.onerror = () => {
    loadImageWithRetry(urls, index + 1);
  };

  outputEl.src = urls[index];
}

generateBtn.addEventListener("click", () => {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    statusEl.textContent = "Pehle prompt likho.";
    return;
  }

  const width = Number(widthEl.value) || 1024;
  const height = Number(heightEl.value) || 1024;
  const firstTry = buildUrl(prompt, width, height);
  const secondTry = buildUrl(prompt, width, height);
  const thirdTry = buildUrl(prompt, width, height);
  const fallback = buildFallbackUrl(prompt, width, height);
  const urls = [firstTry, secondTry, thirdTry, fallback];

  statusEl.textContent = "Image generate ho rahi hai...";
  imageUrlEl.value = firstTry;
  outputEl.style.display = "none";
  loadImageWithRetry(urls);
});

copyBtn.addEventListener("click", async () => {
  if (!imageUrlEl.value) {
    statusEl.textContent = "Generate karke phir copy karo.";
    return;
  }
  await navigator.clipboard.writeText(imageUrlEl.value);
  statusEl.textContent = "Image URL copied.";
});

downloadBtn.addEventListener("click", () => {
  if (!outputEl.src) {
    statusEl.textContent = "Generate karke phir download karo.";
    return;
  }
  const link = document.createElement("a");
  link.href = outputEl.src;
  link.download = "generated-image.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
});
