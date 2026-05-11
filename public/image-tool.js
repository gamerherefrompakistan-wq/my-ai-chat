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
  const seed = Math.floor(Math.random() * 99999999);
  return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
}

// Roman Urdu / Urdu ko English mein translate karo simple words se
function translateToEnglish(prompt) {
  const dict = {
    "kro": "", "karo": "", "generate": "", "banao": "", "bnao": "",
    "cycle": "bicycle", "sawar": "riding", "larki": "girl", "larka": "boy",
    "ghar": "house", "gaari": "car", "pani": "water", "aasman": "sky",
    "phool": "flower", "darya": "river", "pahar": "mountain", "jungle": "forest",
    "raat": "night", "din": "day", "suraj": "sun", "chand": "moon",
    "billi": "cat", "kutta": "dog", "ghora": "horse", "chirya": "bird",
    "admi": "man", "aurat": "woman", "bacha": "child", "dost": "friend",
    "khana": "food", "chai": "tea", "kitab": "book", "school": "school",
    "shahar": "city", "gaon": "village", "sadak": "road", "dukaan": "shop"
  };

  let result = prompt.toLowerCase();
  Object.keys(dict).forEach(urdu => {
    result = result.replace(new RegExp(`\\b${urdu}\\b`, "gi"), dict[urdu]);
  });

  // Clean up extra spaces
  result = result.replace(/\s+/g, " ").trim();

  // Agar kuch bacha nahi toh original rakho
  if (!result || result.length < 3) result = prompt;

  return result + ", realistic, HD, high quality, 4k";
}

function loadImage(url) {
  statusEl.textContent = "Image generate ho rahi hai... ⏳ (30-60 sec lag sakte hain)";
  outputEl.style.display = "none";

  // Timeout — 60 seconds
  const timeout = setTimeout(() => {
    outputEl.src = "";
    statusEl.textContent = "Timeout — dobara Generate karo. ⚠️";
  }, 60000);

  outputEl.onload = () => {
    clearTimeout(timeout);
    statusEl.innerHTML = "Image ready ✅";
    outputEl.style.display = "block";
  };

  outputEl.onerror = () => {
    clearTimeout(timeout);
    // Naye seed ke saath retry
    const prompt = decodeURIComponent(url.split("/prompt/")[1].split("?")[0]);
    const newUrl = buildUrl(prompt, widthEl.value, heightEl.value);
    imageUrlEl.value = newUrl;
    statusEl.textContent = "Retry ho rahi hai... ⏳";
    setTimeout(() => {
      outputEl.src = newUrl;
    }, 3000);
  };

  outputEl.src = url;
}

generateBtn.addEventListener("click", () => {
  const rawPrompt = promptEl.value.trim();
  if (!rawPrompt) {
    statusEl.textContent = "Pehle prompt likho.";
    return;
  }

  const width = Number(widthEl.value) || 1024;
  const height = Number(heightEl.value) || 1024;

  // English mein convert karo
  const englishPrompt = translateToEnglish(rawPrompt);
  const url = buildUrl(englishPrompt, width, height);
  imageUrlEl.value = url;
  loadImage(url);
});

copyBtn.addEventListener("click", async () => {
  if (!imageUrlEl.value) { statusEl.textContent = "Pehle image generate karo."; return; }
  await navigator.clipboard.writeText(imageUrlEl.value);
  statusEl.textContent = "URL copy ho gaya! ✅";
});

downloadBtn.addEventListener("click", () => {
  if (!outputEl.src || outputEl.style.display === "none") {
    statusEl.textContent = "Pehle image generate karo.";
    return;
  }
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
      window.open(outputEl.src, "_blank");
    });
});

