const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("send-btn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openSidebarBtn = document.getElementById("open-sidebar");
const closeSidebarBtn = document.getElementById("close-sidebar");
const newChatBtn = document.getElementById("new-chat-btn");
const chatHistoryEl = document.getElementById("chat-history");
const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const closeSettings = document.getElementById("close-settings");
const langSelect = document.getElementById("lang-select");
const themeSelect = document.getElementById("theme-select");
const clearHistoryBtn = document.getElementById("clear-history-btn");

// Load settings
let selectedLang = localStorage.getItem("lang") || "roman_urdu";
let selectedTheme = localStorage.getItem("theme") || "dark";
langSelect.value = selectedLang;
themeSelect.value = selectedTheme;
if (selectedTheme === "light") document.body.classList.add("light");

// Chat sessions
let sessions = JSON.parse(localStorage.getItem("chatSessions") || "[]");
let currentSessionId = null;

let messages = [
  { role: "system", content: getSystemPrompt() }
];

function getSystemPrompt() {
  if (selectedLang === "english") {
    return "You are a helpful AI assistant. Always respond in English in a friendly and simple way.";
  }
  return "Tum ek helpful AI assistant ho. Hamesha Roman Urdu me jawab do (Urdu lafz magar English letters), simple aur friendly andaz me. English sirf tab use karo jab user khud English maange.";
}

// Sidebar open/close
openSidebarBtn.addEventListener("click", () => {
  sidebar.classList.add("open");
  overlay.classList.add("show");
});

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
  settingsPanel.style.display = "none";
}

closeSidebarBtn.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);

// Settings
settingsBtn.addEventListener("click", () => {
  settingsPanel.style.display = settingsPanel.style.display === "none" ? "block" : "none";
});

closeSettings.addEventListener("click", () => {
  settingsPanel.style.display = "none";
});

langSelect.addEventListener("change", () => {
  selectedLang = langSelect.value;
  localStorage.setItem("lang", selectedLang);
  messages[0] = { role: "system", content: getSystemPrompt() };
});

themeSelect.addEventListener("change", () => {
  selectedTheme = themeSelect.value;
  localStorage.setItem("theme", selectedTheme);
  if (selectedTheme === "light") {
    document.body.classList.add("light");
  } else {
    document.body.classList.remove("light");
  }
});

clearHistoryBtn.addEventListener("click", () => {
  if (confirm("Sari history delete karein?")) {
    sessions = [];
    localStorage.removeItem("chatSessions");
    currentSessionId = null;
    renderHistory();
    startNewChat();
  }
});

// History
function renderHistory() {
  chatHistoryEl.innerHTML = "";
  if (sessions.length === 0) {
    chatHistoryEl.innerHTML = '<p class="no-history">No chats yet</p>';
    return;
  }
  sessions.slice().reverse().forEach(session => {
    const div = document.createElement("div");
    div.className = "history-item" + (session.id === currentSessionId ? " active" : "");
    div.textContent = session.title || "Chat";
    div.addEventListener("click", () => loadSession(session.id));
    chatHistoryEl.appendChild(div);
  });
}

function saveSession() {
  if (!currentSessionId || messages.length <= 1) return;
  const userMsgs = messages.filter(m => m.role === "user");
  if (userMsgs.length === 0) return;
  const title = userMsgs[0].content.substring(0, 30) + (userMsgs[0].content.length > 30 ? "..." : "");
  const existing = sessions.findIndex(s => s.id === currentSessionId);
  if (existing >= 0) {
    sessions[existing].messages = [...messages];
    sessions[existing].title = title;
  } else {
    sessions.push({ id: currentSessionId, title, messages: [...messages] });
  }
  localStorage.setItem("chatSessions", JSON.stringify(sessions));
  renderHistory();
}

function loadSession(id) {
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  currentSessionId = id;
  messages = [...session.messages];
  chatEl.innerHTML = "";
  messages.filter(m => m.role !== "system").forEach(m => appendMessage(m.role, m.content));
  renderHistory();
  closeSidebar();
}

function startNewChat() {
  currentSessionId = Date.now().toString();
  messages = [{ role: "system", content: getSystemPrompt() }];
  chatEl.innerHTML = "";
  renderHistory();
}

newChatBtn.addEventListener("click", () => {
  startNewChat();
  closeSidebar();
});

// Chat
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

  if (!currentSessionId) currentSessionId = Date.now().toString();

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
    saveSession();
  } catch (error) {
    appendMessage("assistant", `Error: ${error.message}`);
  } finally {
    setLoading(false);
    promptEl.focus();
  }
});

// Init
startNewChat();
renderHistory();

