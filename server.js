const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.OPENAI_API_KEY) return null;
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

function getLastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return String(messages[i].content || "");
  }
  return "";
}

function demoReply(userText) {
  return `Demo mode reply: Aapka message mila - "${userText}". OpenAI quota/billing issue ki wajah se app abhi local demo mode me chal raha hai.`;
}

const ASSISTANT_SYSTEM_PROMPT = `
You are My AI Chat, a helpful multilingual assistant.
Rules:
- Reply in the SAME language/script as the user's latest message.
- Correct obvious spelling/grammar mistakes in your own response.
- Keep answers clear, natural, and concise unless user asks for detail.
- For poems, stories, or creative content, write polished and error-free text.
`;

function prepareModelMessages(messages) {
  const cleanMessages = messages
    .filter((msg) => msg && typeof msg.content === "string")
    .map((msg) => ({
      role:
        msg.role === "system" || msg.role === "assistant" ? msg.role : "user",
      content: String(msg.content).trim()
    }))
    .filter((msg) => msg.content.length > 0);

  // Keep only recent context for faster local-model responses.
  const recentMessages = cleanMessages.slice(-8);
  return [{ role: "system", content: ASSISTANT_SYSTEM_PROMPT }, ...recentMessages];
}

async function getOllamaReply(messages) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const preferredModel = process.env.OLLAMA_MODEL || "llama3.2";
  const ollamaMessages = prepareModelMessages(messages);

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: preferredModel,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 220,
        num_ctx: 2048
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data?.message?.content || "No response";
}

function normalizePollinationsKey(raw) {
  if (!raw || typeof raw !== "string") return "";
  let k = raw.trim();
  if (k.startsWith("Bearer ")) k = k.slice(7).trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  const lower = k.toLowerCase();
  if (lower.startsWith("pollinations_api_key=")) {
    k = k.slice("pollinations_api_key=".length).trim();
  }
  return k;
}

async function pollinationsGenerateVideo(prompt, opts) {
  const key = normalizePollinationsKey(process.env.POLLINATIONS_API_KEY);
  if (!key) {
    const err = new Error("MISSING_POLLINATIONS_KEY");
    err.code = "MISSING_POLLINATIONS_KEY";
    throw err;
  }

  const cleanPrompt = String(prompt || "")
    .trim()
    .replace(/\s+/g, " ");
  const duration = Math.min(10, Math.max(1, Number(opts.duration) || 5));
  const aspectRatio =
    opts.aspectRatio === "9:16" || opts.aspectRatio === "16:9"
      ? opts.aspectRatio
      : "16:9";
  const model =
    typeof opts.model === "string" && opts.model.trim()
      ? opts.model.trim()
      : "wan-fast";
  const seed = Number(opts.seed) || Date.now();
  const audio =
    opts.audio === true || String(opts.audio || "").toLowerCase() === "true";

  const authHeaders = {
    Authorization: `Bearer ${key}`,
    Accept: "video/mp4,*/*"
  };

  // Prefer POST (prompt body) — long prompts break GET URLs and often return 400.
  const postBody = {
    prompt: cleanPrompt,
    duration,
    aspectRatio,
    model,
    seed,
    audio
  };

  let upstream = await fetch("https://gen.pollinations.ai/video", {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(postBody)
  });

  const maxGetPrompt = 900;
  const shortPrompt =
    cleanPrompt.length > maxGetPrompt
      ? `${cleanPrompt.slice(0, maxGetPrompt)}…`
      : cleanPrompt;

  const tryGet = async () => {
    const url = `https://gen.pollinations.ai/video/${encodeURIComponent(
      shortPrompt
    )}?duration=${duration}&aspectRatio=${encodeURIComponent(
      aspectRatio
    )}&model=${encodeURIComponent(model)}&seed=${seed}&audio=${
      audio ? "true" : "false"
    }&key=${encodeURIComponent(key)}`;
    return fetch(url, { method: "GET", headers: authHeaders });
  };

  if (upstream.ok) return upstream;

  const getRes = await tryGet();
  return getRes;
}

app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, duration, model, aspectRatio, audio } = req.body || {};
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 4) {
      return res.status(400).json({ error: "Prompt required (at least 4 characters)" });
    }

    let upstream;
    try {
      upstream = await pollinationsGenerateVideo(prompt, {
        duration,
        model,
        aspectRatio,
        audio,
        seed: Date.now()
      });
    } catch (e) {
      if (e.code === "MISSING_POLLINATIONS_KEY") {
        return res.status(503).json({
          error:
            "Server par POLLINATIONS_API_KEY set nahi hai. enter.pollinations.ai se free secret key banwao aur Railway/hosting env me lagao.",
          hint: "https://enter.pollinations.ai"
        });
      }
      throw e;
    }

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("Pollinations video error:", upstream.status, text);
      return res.status(502).json({
        error: `Video generation failed (${upstream.status})`,
        detail: text.slice(0, 800)
      });
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "no-store");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (error) {
    console.error("generate-video:", error?.message || error);
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Unknown server error";
    res.status(500).json({ error: message });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array required" });
    }

    const userText = getLastUserMessage(messages);
    const useOllama = String(process.env.USE_OLLAMA || "").toLowerCase() === "true";
    const openai = getClient();
    if (useOllama || !openai) {
      try {
        const ollamaText = await getOllamaReply(messages);
        return res.json({ reply: ollamaText });
      } catch (error) {
        console.error("Ollama fallback error:", error?.message || error);
        return res.json({
          reply: `Ollama error: ${error?.message || "Unknown Ollama error"}`
        });
      }
    }

    let response;
    try {
      const modelMessages = prepareModelMessages(messages);
      response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: modelMessages,
        temperature: 0.4
      });
    } catch (apiError) {
      const statusCode =
        apiError?.status || apiError?.response?.status || apiError?.code;
      const quotaMessage = String(apiError?.message || "").toLowerCase();
      const isQuotaError =
        statusCode === 429 ||
        quotaMessage.includes("quota") ||
        quotaMessage.includes("billing");

      if (isQuotaError) {
        try {
          const ollamaText = await getOllamaReply(messages);
          return res.json({ reply: ollamaText });
        } catch (_error) {
          return res.json({
            reply: demoReply(userText)
          });
        }
      }
      throw apiError;
    }

    const text = response.choices?.[0]?.message?.content || "No response";
    return res.json({ reply: text });
  } catch (error) {
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Unknown server error";
    return res.status(500).json({ error: message });
  }
});

app.get("*", (req, res) => {
  // Explicit .html/.css/etc. URLs should NOT fall back to the chat SPA —
  // otherwise missing deploy files look "broken" (same chat UI on every URL).
  if (path.extname(req.path)) {
    return res.status(404).type("text/plain").send("Not found");
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
