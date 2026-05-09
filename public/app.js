const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("send-btn");

const messages = [
  {
    role: "system",
    content:
      "Tum ek helpful AI assistant ho. Hamesha Roman Urdu me jawab do (Urdu lafz magar English letters), simple aur friendly andaz me. English sirf tab use karo jab user khud English maange."
  }
];

function appendMessage(role, content) {
  const div = document.createElement("div");
  div.className = `msg ${role === "user" ? "user" : "assistant"}`;
  div.textContent = content;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  sendBtn.textContent = isLoading ? "..." : "Send";
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = promptEl.value.trim();
  if (!text) return;

  promptEl.value = "";
  appendMessage("user", text);
  messages.push({ role: "user", content: text });

  setLoading(true);
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");

    appendMessage("assistant", data.reply);
    messages.push({ role: "assistant", content: data.reply });
  } catch (error) {
    appendMessage("assistant", `Error: ${error.message}`);
  } finally {
    setLoading(false);
    promptEl.focus();
  }
});
