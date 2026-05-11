const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const crypto = require("crypto");
const fs = require("fs");
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   USER DATABASE (JSON FILE)
========================= */
const DB_PATH = path.join(__dirname, "users.json");

function loadUsers() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    }
  } catch (e) {}
  return {};
}

function saveUsers(users) {
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "myaichat_salt").digest("hex");
}

function generateToken(userId) {
  const payload = { userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64");
  const sig = crypto.createHmac("sha256", process.env.JWT_SECRET || "myaichat_secret").update(data).digest("hex");
  return `${data}.${sig}`;
}

function verifyToken(token) {
  try {
    const [data, sig] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", process.env.JWT_SECRET || "myaichat_secret").update(data).digest("hex");
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, "base64").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getUserFromReq(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) return null;
  const users = loadUsers();
  return users[payload.userId] || null;
}

/* =========================
   AUTH ROUTES
========================= */
app.post("/api/auth/signup", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Sab fields required hain" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password kam se kam 6 characters ka hona chahiye" });

  const users = loadUsers();
  const existing = Object.values(users).find(u => u.email === email.toLowerCase());
  if (existing)
    return res.status(400).json({ error: "Ye email already registered hai" });

  const userId = crypto.randomBytes(16).toString("hex");
  users[userId] = {
    id: userId, name, email: email.toLowerCase(),
    password: hashPassword(password), plan: "free",
    createdAt: new Date().toISOString(),
    avatar: name.charAt(0).toUpperCase()
  };
  saveUsers(users);
  const token = generateToken(userId);
  res.json({ token, user: { id: userId, name, email: email.toLowerCase(), plan: "free", avatar: name.charAt(0).toUpperCase() } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email aur password required hain" });

  const users = loadUsers();
  const user = Object.values(users).find(u => u.email === email.toLowerCase());
  if (!user || user.password !== hashPassword(password))
    return res.status(401).json({ error: "Email ya password galat hai" });

  const token = generateToken(user.id);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan, avatar: user.avatar || user.name.charAt(0).toUpperCase() } });
});

app.get("/api/auth/me", (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  res.json({ user: { id: user.id, name: user.name, email: user.email, plan: user.plan, avatar: user.avatar || user.name.charAt(0).toUpperCase() } });
});

/* =========================
   SUBSCRIPTION SYSTEM
========================= */
const FREE_DAILY_LIMIT = 10;
const usageStore = {};

function getClientIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function checkUsage(identifier, isPremium) {
  if (isPremium) return { allowed: true, premium: true };
  const today = getToday();
  if (!usageStore[identifier] || usageStore[identifier].date !== today) {
    usageStore[identifier] = { count: 0, date: today };
  }
  const user = usageStore[identifier];
  if (user.count >= FREE_DAILY_LIMIT) return { allowed: false, premium: false };
  user.count++;
  return { allowed: true, premium: false, remaining: FREE_DAILY_LIMIT - user.count };
}

/* =========================
   GEMINI AI — FIXED
========================= */
const SYSTEM_PROMPT = `You are My AI Chat assistant. Reply in same language as user. Be helpful and friendly.`;

async function callGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY set nahi hai Railway pe");

  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents
      })
    }
  );

  const data = await response.json();

  // Detailed logging for debugging
  console.log("[Gemini] Status:", response.status);
  if (!response.ok) {
    console.error("[Gemini] Error:", JSON.stringify(data));
    throw new Error(`Gemini API error ${response.status}: ${data?.error?.message || "Unknown error"}`);
  }

  // Check for blocked content
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    console.error("[Gemini] No candidates:", JSON.stringify(data));
    throw new Error("Gemini ne koi jawab nahi diya — candidates empty");
  }

  if (candidate.finishReason === "SAFETY") {
    throw new Error("Message safety filter se block hua");
  }

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("[Gemini] Empty text:", JSON.stringify(candidate));
    throw new Error("Gemini response mein text nahi mila");
  }

  return text;
}

/* =========================
   CHAT API
========================= */
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array required hai" });
    }

    const user = getUserFromReq(req);
    const identifier = user ? user.id : getClientIP(req);
    const isPremium = user?.plan === "premium";
    const usage = checkUsage(identifier, isPremium);

    if (!usage.allowed) {
      return res.status(429).json({
        error: "limit_reached",
        message: "Aapki free limit khatam ho gayi. Premium lein: Rs. 300/month"
      });
    }

    const reply = await callGemini(messages);
    res.json({ reply, usage });

  } catch (err) {
    console.error("[Chat Error]", err.message);
    res.status(500).json({ error: err.message || "Server error aa gaya" });
  }
});

/* =========================
   USAGE CHECK
========================= */
app.get("/api/usage", (req, res) => {
  const user = getUserFromReq(req);
  const identifier = user ? user.id : getClientIP(req);
  const isPremium = user?.plan === "premium";
  if (isPremium) return res.json({ plan: "premium", remaining: "unlimited" });
  const today = getToday();
  const data = usageStore[identifier];
  const used = data?.date === today ? data.count : 0;
  res.json({ plan: "free", used, remaining: Math.max(0, FREE_DAILY_LIMIT - used), total: FREE_DAILY_LIMIT });
});

/* =========================
   VIDEO GENERATION
========================= */
app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, duration, model, aspectRatio } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });

    const key = process.env.POLLINATIONS_API_KEY;
    if (!key) return res.status(503).json({ error: "POLLINATIONS_API_KEY not set" });

    const upstream = await fetch("https://gen.pollinations.ai/video", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ prompt, duration: duration || 5, model: model || "wan-fast", aspectRatio: aspectRatio || "16:9" })
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(502).json({ error: "Video generation failed", detail: text.slice(0, 500) });
    }

    res.setHeader("Content-Type", "video/mp4");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   FRONTEND ROUTE
========================= */
app.get("*", (req, res) => {
  if (path.extname(req.path)) return res.status(404).send("Not found");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

