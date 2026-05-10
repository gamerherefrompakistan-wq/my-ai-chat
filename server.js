const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─────────────────────────────────────────────
// SUBSCRIPTION SYSTEM
// ─────────────────────────────────────────────
const FREE_DAILY_LIMIT = 10;

const usageStore = {};

const PAID_USERS = new Set([
  ...(process.env.PAID_IPS ? process.env.PAID_IPS.split(",").map(s => s.trim()) : [])
]);

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function checkAndUpdateUsage(ip) {
  const today = getTodayDate();
  if (PAID_USERS.has(ip)) {
    return { allowed: true, isPaid: true, remaining: "unlimited" };
  }
  if (!usageStore[ip] || usageStore[ip].date !== today) {
    usageStore[ip] = { count: 0, date: today };
  }
  const usage = usageStore[ip];
  if (usage.count >= FREE_DAILY_LIMIT) {
    return { allowed: false, isPaid: false, remaining: 0 };
  }
  usage.count += 1;
  return { allowed: true, isPaid: false, remaining: FREE_DAILY_LIMIT - usage.count };
}

// ─────────────────────────────────────────────
// GEMINI
// ─────────────────────────────────────────────
function getLastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      const c = messages[i].content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) return c.find(p => p.type === "text")?.text || "";
    }
  }
  return "";
}

const ASSISTANT_SYSTEM_PROMPT = `You are My AI Chat, a helpful multilingual assistant.
Rules:
- Reply in the SAME language/script as the user's latest message.
- Keep answers clear, natural, and concise.
- You can analyze images when provided.`;

function prepareGeminiMessages(messages) {
  const cleanMessages = messages
    .filter((msg) => msg && (typeof msg.content === "string" || Array.isArray(msg.content)))
    .map((msg) => {
      const role = msg.role === "assistant" ? "model" : "user";
      if (Array.isArray(msg.content)) {
        const parts = msg.content.map((part) => {
          if (part.type === "text") return { text: part.text };
          if (part.type === "image_url") {
            const dataUrl = part.image_url.url;
            const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
            if (matches) return { inline_data: { mime_type: matches[1], data: matches[2] } };
          }
          return null;
        }).filter(Boolean);
        return { role, parts };
      }
      const text = String(msg.content).trim();
      if (!text) return null;
      return { role, parts: [{ text }] };
    })
    .filter(Boolean);
  return cleanMessages.slice(-8);
}

async function getGeminiReply(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const geminiMessages = prepareGeminiMessages(messages);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: ASSISTANT_SYSTEM_PROMPT }] },
        contents: geminiMessages,
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
      })
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
}

// ─────────────────────────────────────────────
// POLLINATIONS VIDEO
// ─────────────────────────────────────────────
const POLLINATIONS_MAX_SEED = 2147483647;
function toPollinationsSeed(value) {
  const fallback = Date.now() % POLLINATIONS_MAX_SEED;
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  n = Math.abs(n) % POLLINATIONS_MAX_SEED;
  return n === 0 ? fallback || 1 : n;
}

function normalizePollinationsKey(raw) {
  if (!raw || typeof raw !== "string") return "";
  let k = raw.trim();
  if (k.startsWith("Bearer ")) k = k.slice(7).trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1).trim();
  const lower = k.toLowerCase();
  if (lower.startsWith("pollinations_api_key=")) k = k.slice("pollinations_api_key=".length).trim();
  return k;
}

async function pollinationsGenerateVideo(prompt, opts) {
  const key = normalizePollinationsKey(process.env.POLLINATIONS_API_KEY);
  if (!key) { const err = new Error("MISSING_POLLINATIONS_KEY"); err.code = "MISSING_POLLINATIONS_KEY"; throw err; }
  const cleanPrompt = String(prompt || "").trim().replace(/\s+/g, " ");
  const duration = Math.min(10, Math.max(1, Number(opts.duration) || 5));
  const aspectRatio = opts.aspectRatio === "9:16" || opts.aspectRatio === "16:9" ? opts.aspectRatio : "16:9";
  const model = typeof opts.model === "string" && opts.model.trim() ? opts.model.trim() : "wan-fast";
  const seed = toPollinationsSeed(opts.seed ?? Date.now());
  const audio = opts.audio === true || String(opts.audio || "").toLowerCase() === "true";
  const authHeaders = { Authorization: `Bearer ${key}`, Accept: "video/mp4,*/*" };
  const postBody = { prompt: cleanPrompt, duration, aspectRatio, model, seed, audio };
  let upstream = await fetch("https://gen.pollinations.ai/video", {
    method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(postBody)
  });
  if (upstream.ok) return upstream;
  const maxGetPrompt = 900;
  const shortPrompt = cleanPrompt.length > maxGetPrompt ? `${cleanPrompt.slice(0, maxGetPrompt)}…` : cleanPrompt;
  const url = `https://gen.pollinations.ai/video/${encodeURIComponent(shortPrompt)}?duration=${duration}&aspectRatio=${encodeURIComponent(aspectRatio)}&model=${encodeURIComponent(model)}&seed=${seed}&audio=${audio ? "true" : "false"}&key=${encodeURIComponent(key)}`;
  return fetch(url, { method: "GET", headers: authHeaders });
}

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array required" });
    }
    const ip = getClientIP(req);
    const usage = checkAndUpdateUsage(ip);
    if (!usage.allowed) {
      return res.status(429).json({
        error: "limit_reached",
        message: `Aapki aaj ki free limit (${FREE_DAILY_LIMIT} messages) khatam ho gayi! 😔\n\nPremium lene ke liye JazzCash/EasyPaisa karein:\n📱 ${process.env.JAZZCASH_NUMBER || "0300-XXXXXXX"}\nAmount: Rs. 300/month\n\nPayment ke baad WhatsApp karein aur unlimited access paaein! 🚀`,
        jazzcash: process.env.JAZZCASH_NUMBER || "0300-XXXXXXX",
        price: "Rs. 300/month"
      });
    }
    try {
      const reply = await getGeminiReply(messages);
      return res.json({
        reply,
        usage: usage.isPaid
          ? { plan: "premium", remaining: "unlimited" }
          : { plan: "free", remaining: usage.remaining, total: FREE_DAILY_LIMIT }
      });
    } catch (error) {
      console.error("Gemini API error:", error?.message || error);
      return res.status(500).json({ error: "AI service error. Thodi der baad try karein." });
    }
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Unknown server error" });
  }
});

app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, duration, model, aspectRatio, audio } = req.body || {};
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 4) {
      return res.status(400).json({ error: "Prompt required (at least 4 characters)" });
    }
    const ip = getClientIP(req);
    if (!PAID_USERS.has(ip)) {
      return res.status(403).json({
        error: "premium_required",
        message: `Video generation sirf Premium users ke liye hai! 🎬\n\nPremium lene ke liye:\n📱 ${process.env.JAZZCASH_NUMBER || "0300-XXXXXXX"}\nAmount: Rs. 300/month`
      });
    }
    let upstream;
    try {
      upstream = await pollinationsGenerateVideo(prompt, { duration, model, aspectRatio, audio, seed: toPollinationsSeed(Date.now()) });
    } catch (e) {
      if (e.code === "MISSING_POLLINATIONS_KEY") {
        return res.status(503).json({ error: "POLLINATIONS_API_KEY set nahi hai." });
      }
      throw e;
    }
    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(502).json({ error: `Video generation failed (${upstream.status})`, detail: text.slice(0, 800) });
    }
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "no-store");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (error) {
    res.status(500).json({ error: error?.message || "Unknown server error" });
  }
});

app.get("/api/usage", (req, res) => {
  const ip = getClientIP(req);
  const today = getTodayDate();
  const isPaid = PAID_USERS.has(ip);
  if (isPaid) return res.json({ plan: "premium", remaining: "unlimited" });
  const usage = usageStore[ip];
  const used = (usage && usage.date === today) ? usage.count : 0;
  return res.json({ plan: "free", used, remaining: Math.max(0, FREE_DAILY_LIMIT - used), total: FREE_DAILY_LIMIT });
});

app.get("*", (req, res) => {
  if (path.extname(req.path)) return res.status(404).type("text/plain").send("Not found");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
