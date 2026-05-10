const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   SUBSCRIPTION SYSTEM
========================= */

const FREE_DAILY_LIMIT = 10;
const usageStore = {};

// paid users (IP based)
const PAID_USERS = new Set(
  (process.env.PAID_IPS || "")
    .split(",")
    .map(ip => ip.trim())
    .filter(Boolean)
);

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function checkUsage(ip) {
  const today = getToday();

  // premium user
  if (PAID_USERS.has(ip)) {
    return { allowed: true, premium: true };
  }

  // init user
  if (!usageStore[ip] || usageStore[ip].date !== today) {
    usageStore[ip] = { count: 0, date: today };
  }

  const user = usageStore[ip];

  if (user.count >= FREE_DAILY_LIMIT) {
    return { allowed: false, premium: false };
  }

  user.count++;
  return {
    allowed: true,
    premium: false,
    remaining: FREE_DAILY_LIMIT - user.count
  };
}

/* =========================
   GEMINI AI
========================= */

const SYSTEM_PROMPT = `
You are My AI Chat assistant.
- Reply in same language as user
- Be short and helpful
`;

function getLastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return typeof messages[i].content === "string"
        ? messages[i].content
        : "";
    }
  }
  return "";
}

async function callGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }))
      })
    }
  );

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
}

/* =========================
   CHAT API
========================= */

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const ip = getClientIP(req);

    const usage = checkUsage(ip);

    // LIMIT REACHED
    if (!usage.allowed) {
      return res.status(429).json({
        error: "limit_reached",
        message: `Aapki free limit khatam ho gayi 😔\nPremium lein:\nRs. 300/month`,
        contact: process.env.JAZZCASH_NUMBER || "0300-XXXXXXX"
      });
    }

    const reply = await callGemini(messages);

    res.json({
      reply,
      usage
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   USAGE CHECK
========================= */

app.get("/api/usage", (req, res) => {
  const ip = getClientIP(req);
  const today = getToday();

  const isPaid = PAID_USERS.has(ip);

  if (isPaid) {
    return res.json({ plan: "premium", remaining: "unlimited" });
  }

  const user = usageStore[ip];
  const used = user?.date === today ? user.count : 0;

  res.json({
    plan: "free",
    used,
    remaining: Math.max(0, FREE_DAILY_LIMIT - used),
    total: FREE_DAILY_LIMIT
  });
});

/* =========================
   FRONTEND ROUTE
========================= */

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
