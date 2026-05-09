const form = document.getElementById("builder-form");
const preview = document.getElementById("preview");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const downloadBtn = document.getElementById("downloadBtn");
const generateImageBtn = document.getElementById("generateImageBtn");
const imagePromptEl = document.getElementById("imagePrompt");
const generatedImageUrlEl = document.getElementById("generatedImageUrl");
const imagePreviewEl = document.getElementById("imagePreview");

let latestHtml = "";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function createWebsiteHtml(data) {
  const businessName = escapeHtml(data.businessName || "My Business");
  const tagline = escapeHtml(data.tagline || "We help you grow.");
  const businessType = escapeHtml(data.businessType || "Business");
  const logoText = escapeHtml(data.logoText || businessName.slice(0, 2).toUpperCase());
  const promptText = escapeHtml(data.promptText || "Clean, modern and conversion-focused style.");
  const imageUrl = escapeHtml(
    data.generatedImageUrl ||
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80"
  );
  const email = escapeHtml(data.email || "hello@example.com");
  const whatsapp = escapeHtml(data.whatsapp || "");
  const primaryColor = data.primaryColor || "#2f6feb";

  const services = (data.services || "")
    .split(",")
    .map((item) => escapeHtml(item.trim()))
    .filter(Boolean);

  const servicesHtml = services.length
    ? services.map((service) => `<div class="card">${service}</div>`).join("")
    : "<div class=\"card\">Custom Service 1</div><div class=\"card\">Custom Service 2</div><div class=\"card\">Custom Service 3</div>";

  const whatsappLink = whatsapp ? `https://wa.me/${whatsapp}` : "#contact";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${businessName}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, sans-serif; color: #111; background: #f8fafc; scroll-behavior: smooth; }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 0 16px; }
      .top { background: #0f172a; color: #fff; }
      .nav { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; }
      .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; }
      .mark { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: ${primaryColor}; color: #fff; }
      .hero { padding: 72px 0; background: linear-gradient(135deg, #0f172a 0%, #111827 70%, ${primaryColor} 160%); color: #fff; overflow: hidden; position: relative; }
      .hero::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 80% 20%, rgba(255,255,255,0.12), transparent 40%); }
      .hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; align-items: center; }
      .hero h1 { margin: 0 0 10px; font-size: 44px; }
      .hero p { margin: 0 0 20px; max-width: 620px; line-height: 1.6; color: #dbeafe; }
      .hero-img { width: 100%; border-radius: 16px; border: 1px solid rgba(255,255,255,0.22); box-shadow: 0 20px 40px rgba(2, 6, 23, 0.35); animation: floatY 6s ease-in-out infinite; }
      .btn { display: inline-block; padding: 12px 18px; border-radius: 10px; text-decoration: none; background: ${primaryColor}; color: #fff; font-weight: 700; }
      .section { padding: 56px 0; }
      .section h2 { margin: 0 0 10px; font-size: 30px; }
      .muted { color: #475569; line-height: 1.6; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05); transition: transform .25s ease, box-shadow .25s ease; }
      .card:hover { transform: translateY(-6px); box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14); }
      .about { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: center; }
      .about-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
      .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
      .stat { background: #eff6ff; border-radius: 10px; padding: 12px; text-align: center; }
      .stat b { display: block; font-size: 20px; color: #0f172a; }
      .testimonial { background: #0f172a; color: #dbeafe; border-radius: 12px; padding: 20px; margin-top: 14px; }
      .contact { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
      .footer { padding: 20px 0; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
      .reveal { opacity: 0; transform: translateY(20px); animation: reveal .8s ease forwards; }
      .reveal.delay-1 { animation-delay: .15s; }
      .reveal.delay-2 { animation-delay: .3s; }
      .reveal.delay-3 { animation-delay: .45s; }
      @keyframes reveal { to { opacity: 1; transform: translateY(0); } }
      @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @media (max-width: 860px) {
        .hero h1 { font-size: 32px; }
        .hero-grid { grid-template-columns: 1fr; }
        .about { grid-template-columns: 1fr; }
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <header class="top">
      <div class="wrap nav">
        <div class="logo">
          <div class="mark">${logoText}</div>
          <span>${businessName}</span>
        </div>
        <a class="btn" href="${whatsappLink}">Contact Now</a>
      </div>
    </header>

    <section class="hero">
      <div class="wrap hero-grid">
        <div class="reveal">
          <h1>${tagline}</h1>
          <p>${businessType} - ${promptText}</p>
          <a class="btn" href="#services">View Services</a>
        </div>
        <img class="hero-img reveal delay-1" src="${imageUrl}" alt="${businessName} cover image" />
      </div>
    </section>

    <section class="section">
      <div class="wrap about">
        <div class="about-box reveal">
          <h2>About ${businessName}</h2>
          <p class="muted">
            Humara focus simple hai: ${businessType} ke liye high quality service dena, clear communication rakhna, aur customer results improve karna.
          </p>
          <div class="stats">
            <div class="stat"><b>120+</b><span>Projects</span></div>
            <div class="stat"><b>95%</b><span>Satisfaction</span></div>
            <div class="stat"><b>24/7</b><span>Support</span></div>
          </div>
        </div>
        <div class="testimonial reveal delay-1">
          <h3>Client Feedback</h3>
          <p>
            "Team ne hamare business ki online presence completely transform kar di. Design modern, fast aur conversion-friendly hai."
          </p>
        </div>
      </div>
    </section>

    <section id="services" class="section">
      <div class="wrap">
        <h2 class="reveal">Our Services</h2>
        <p class="muted">Ye section tumhari business offerings ko highlight karta hai.</p>
        <div class="grid reveal delay-1">
          ${servicesHtml}
        </div>
      </div>
    </section>

    <section id="contact" class="section">
      <div class="wrap contact">
        <h2 class="reveal">Contact Us</h2>
        <p class="muted">Email: ${email}</p>
        <p class="muted">WhatsApp: ${whatsapp || "Add your WhatsApp number"}</p>
        <a class="btn reveal delay-1" href="${whatsappLink}" style="margin-top: 8px;">Chat on WhatsApp</a>
      </div>
    </section>

    <footer class="footer">
      <div class="wrap">© ${new Date().getFullYear()} ${businessName}. All rights reserved.</div>
    </footer>
  </body>
</html>`;
}

function updatePreview(html) {
  preview.srcdoc = html;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = {
    businessName: document.getElementById("businessName").value.trim(),
    tagline: document.getElementById("tagline").value.trim(),
    businessType: document.getElementById("businessType").value.trim(),
    primaryColor: document.getElementById("primaryColor").value,
    logoText: document.getElementById("logoText").value.trim(),
    promptText: document.getElementById("promptText").value.trim(),
    generatedImageUrl: generatedImageUrlEl.value.trim(),
    services: document.getElementById("services").value.trim(),
    whatsapp: document.getElementById("whatsapp").value.trim(),
    email: document.getElementById("email").value.trim()
  };

  latestHtml = createWebsiteHtml(data);
  updatePreview(latestHtml);
});

generateImageBtn.addEventListener("click", () => {
  const prompt = imagePromptEl.value.trim();
  if (!prompt) {
    generateImageBtn.textContent = "Write prompt first";
    setTimeout(() => {
      generateImageBtn.textContent = "Generate Hero Image";
    }, 1200);
    return;
  }

  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1600&height=900&seed=${Date.now()}`;
  generatedImageUrlEl.value = imageUrl;
  imagePreviewEl.src = imageUrl;
  imagePreviewEl.style.display = "block";
  generateImageBtn.textContent = "Image Generated";
  setTimeout(() => {
    generateImageBtn.textContent = "Generate Hero Image";
  }, 1200);
});

copyCodeBtn.addEventListener("click", async () => {
  if (!latestHtml) return;
  await navigator.clipboard.writeText(latestHtml);
  copyCodeBtn.textContent = "Copied";
  setTimeout(() => {
    copyCodeBtn.textContent = "Copy HTML";
  }, 1200);
});

downloadBtn.addEventListener("click", () => {
  if (!latestHtml) return;
  const blob = new Blob([latestHtml], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "generated-website.html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
});

// Create first preview with default values so user gets instant output.
latestHtml = createWebsiteHtml({});
updatePreview(latestHtml);
