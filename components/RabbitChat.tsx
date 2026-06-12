"use client";

/**
 * Fenêtre de chat avec un lapin. `payload` décrit le mode (réel : {slug,
 * playerId} ; démo : {demo:true, name, seed}) ; il est fusionné avec
 * {messages} dans l'appel POST /api/agent/chat.
 */
import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function RabbitChat({
  name,
  payload,
  onClose,
}: {
  name: string;
  payload: Record<string, unknown>;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: `Hi! I'm ${name} 🐰 Ask me anything about this week's Rabbit…` },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(): Promise<void> {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    // On n'envoie PAS le message d'accueil local à l'API (le 1er doit être 'user').
    const history = messages.filter((m, i) => !(i === 0 && m.role === "assistant"));
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, messages: [...history, { role: "user", content: text }] }),
      });
      const data = (await res.json()) as { reply?: string };
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "🐰 *…*" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "🐰 *lost the thread* - try again?" }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rabbit-chat">
      <div className="rabbit-chat-head">
        <span>🐰 {name}</span>
        <button onClick={onClose} aria-label="Close chat">
          ×
        </button>
      </div>
      <div className="rabbit-chat-body" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`rc-msg rc-${m.role}`}>
            {m.content}
          </div>
        ))}
        {sending && <div className="rc-msg rc-assistant rc-typing">🐰 …</div>}
      </div>
      <form
        className="rabbit-chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the rabbit…"
          maxLength={400}
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
