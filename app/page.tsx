
"use client";

import { useRef, useState } from "react";

type Mode = "chat" | "coding" | "search" | "file" | "image";

type Message = {
  role: "user" | "assistant";
  text: string;
  image?: string;
};

const modes: { id: Mode; label: string; icon: string }[] = [
  { id: "chat", label: "AI Chat", icon: "✦" },
  { id: "coding", label: "Coding", icon: "</>" },
  { id: "search", label: "Web Search", icon: "⌕" },
  { id: "file", label: "File Analysis", icon: "▤" },
  { id: "image", label: "Image Creator", icon: "▧" },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<{
    name: string;
    data: string;
    mimeType: string;
  } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];

    if (!selected) return;

    if (selected.size > 3 * 1024 * 1024) {
      alert("Please upload a file smaller than 3 MB.");
      event.target.value = "";
      return;
    }

    const allowed = [
      "application/pdf",
      "text/plain",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowed.includes(selected.type)) {
      alert("Please upload a PDF, TXT, PNG, JPG, or WEBP file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      const data = result.split(",")[1];

      setFile({
        name: selected.name,
        data,
        mimeType: selected.type,
      });

      setMode("file");
    };

    reader.readAsDataURL(selected);
  }

  async function sendMessage() {
    const text = input.trim();

    if ((!text && !file) || loading) return;

    const userMessage: Message = {
      role: "user",
      text: text || `Analyze ${file?.name}`,
    };

    const previousMessages = messages;

    setMessages([...previousMessages, userMessage]);
    setInput("");
    setLoading(true);

    try {
      if (mode === "image") {
        const response = await fetch("/api/image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: text,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Image generation failed.");
        }

        setMessages((old) => [
          ...old,
          {
            role: "assistant",
            text: "Here is your generated image.",
            image: data.image,
          },
        ]);
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text || `Analyze ${file?.name}`,
            mode,
            history: previousMessages.map((item) => ({
              role: item.role,
              text: item.text,
            })),
            file,
          }),
        });

        
if (!response.ok) {
  const data = await response.json().catch(() => ({}));
  throw new Error(data.error || "AI response failed.");
}

if (!response.body) {
  throw new Error("Your browser could not receive the AI response.");
}

// Add an empty assistant message that will fill as text arrives.
setMessages((old) => [
  ...old,
  { role: "assistant", text: "" },
]);

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value, { stream: true });

  setMessages((old) => {
    const updated = [...old];
    const last = updated[updated.length - 1];

    if (last?.role === "assistant") {
      updated[updated.length - 1] = {
        ...last,
        text: last.text + chunk,
      };
    }

    return updated;
  });
}

const remaining = decoder.decode();

if (remaining) {
  setMessages((old) => {
    const updated = [...old];
    const last = updated[updated.length - 1];

    if (last?.role === "assistant") {
      updated[updated.length - 1] = {
        ...last,
        text: last.text + remaining,
      };
    }

    return updated;
  });
}

      }

      setFile(null);

      if (fileInput.current) {
        fileInput.current.value = "";
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          text: `Error: ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setMessages([]);
    setInput("");
    setFile(null);
    setMode("chat");
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✦</div>
          <div>
            <h2>Celestrial AI</h2>
            <span>Your AI universe</span>
          </div>
        </div>

        <button className="new-chat" onClick={newChat}>
          + New Chat
        </button>

        <div className="side-label">AI FEATURES</div>

        <nav className="navigation">
          {modes.map((item) => (
            <button
              key={item.id}
              className={
                mode === item.id ? "nav-item active" : "nav-item"
              }
              onClick={() => setMode(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="avatar">C</div>
          <div>
            <strong>Celestrial AI</strong>
            <span>Free AI Assistant</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="mobile-brand">
            <span>✦</span> Celestrial AI
          </div>

          <div className="topbar-title">
            {modes.find((item) => item.id === mode)?.label}
          </div>

          <div className="status">
            <span className="status-dot" />
            AI Assistant
          </div>
        </header>

        <div className="chat-area">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon">✦</div>

              <div className="welcome-badge">
                YOUR PERSONAL AI
              </div>

              <h1>
                Welcome to <span>Celestrial AI</span>
              </h1>

              <p>
                Your universe of intelligence.
                <br />
                What would you like to explore today?
              </p>

              <div className="suggestions">
                <button
                  onClick={() => {
                    setMode("coding");
                    setInput("Help me build a website with HTML and CSS.");
                  }}
                >
                  <span>⌘</span>
                  <strong>Build something</strong>
                  <small>Get coding assistance</small>
                </button>

                <button
                  onClick={() => {
                    setMode("search");
                    setInput("What are the latest AI developments?");
                  }}
                >
                  <span>⌕</span>
                  <strong>Explore the web</strong>
                  <small>Find current information</small>
                </button>

                <button
                  onClick={() => {
                    setMode("image");
                    setInput("A futuristic galaxy with glowing stars");
                  }}
                >
                  <span>▧</span>
                  <strong>Create an image</strong>
                  <small>Turn ideas into visuals</small>
                </button>

                <button
                  onClick={() => {
                    setMode("file");
                    fileInput.current?.click();
                  }}
                >
                  <span>▤</span>
                  <strong>Analyze a file</strong>
                  <small>Upload a document</small>
                </button>
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`message ${message.role}`}
                >
                  <div className="message-avatar">
                    {message.role === "assistant" ? "✦" : "Y"}
                  </div>

                  <div className="message-content">
                    <div className="message-name">
                      {message.role === "assistant"
                        ? "Celestrial AI"
                        : "You"}
                    </div>

                    <div className="message-text">
                      {message.text}
                    </div>

                    {message.image && (
                      <img
                        className="generated-image"
                        src={message.image}
                        alt="AI generated image"
                      />
                    )}
                  </div>
                </div>
              ))}

              {loading &&
  (!messages.length ||
    messages[messages.length - 1]?.role !== "assistant" ||
    !messages[messages.length - 1]?.text) && (
                <div className="loading">
                  <span />
                  <span />
                  <span />
                  <p>Celestrial AI is thinking...</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {file && (
            <div className="file-preview">
              <span>▤ {file.name}</span>

              <button onClick={() => setFile(null)}>
                Remove
              </button>
            </div>
          )}

          <div className="composer">
            <button
              className="attach-button"
              title="Upload a file"
              onClick={() => fileInput.current?.click()}
            >
              +
            </button>

            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
              hidden
              onChange={handleFile}
            />

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                mode === "image"
                  ? "Describe the image you want..."
                  : mode === "coding"
                  ? "Ask a coding question..."
                  : mode === "search"
                  ? "Search the web..."
                  : "Message Celestrial AI..."
              }
              rows={1}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
            />

            <button
              className="send-button"
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !file)}
            >
              ↑
            </button>
          </div>

          <div className="disclaimer">
            Celestrial AI can make mistakes. Verify important information.
          </div>
        </div>
      </section>
    </main>
  );
}
