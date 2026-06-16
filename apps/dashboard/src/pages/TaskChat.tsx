import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageSquare, RotateCcw, Send } from "lucide-react";
import { postAgentChat } from "../api";
import { parseVoiceResult } from "../voice/parseVoiceResult";

interface Turn {
  role: "user" | "agent";
  text: string;
  actionsTaken?: string[];
}

const EXAMPLE_PROMPTS = [
  "What's on my desk right now?",
  "Add reminder: check gateway logs tonight",
  "Summarize my active projects",
  "Show me pinned notes",
];

export default function TaskChat() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setError(null);
      setSending(true);
      const userTurn: Turn = { role: "user", text: trimmed };
      const nextTurns = [...turns, userTurn];
      setTurns(nextTurns);
      setDraft("");

      try {
        const history = nextTurns.slice(0, -1).map((t) => ({
          role: t.role,
          text: t.text,
        }));
        const result = await postAgentChat(trimmed, history);
        const parsed = parseVoiceResult(result.reply);
        const replyText = parsed.spokenText || result.reply;

        setTurns((prev) => [
          ...prev,
          {
            role: "agent",
            text: replyText,
            actionsTaken: parsed.voice?.actionsTaken,
          },
        ]);

        if (parsed.navigateTo) {
          navigate(parsed.navigateTo);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed");
        setTurns((prev) => prev.slice(0, -1));
        setDraft(trimmed);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [navigate, sending, turns],
  );

  function clearChat() {
    setTurns([]);
    setError(null);
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <div className="page-shell page-shell--chat">
      <header className="page-shell__header">
        <button
          type="button"
          className="back-btn"
          onClick={() => navigate("/")}
        >
          ← Back
        </button>
        <h1 className="page-title">Agent chat</h1>
        <p className="page-subtitle">
          Text your OpenClaw agent on the desk. For phone chat with full history,
          use{" "}
          <Link to="/settings" className="voice-page__link">
            Telegram via OpenClaw
          </Link>
          .
        </p>
      </header>

      <div className="page-shell__body chat-page">
        <div className="chat-page__log" ref={logRef} aria-live="polite">
          {turns.length === 0 && !sending && (
            <div className="chat-page__empty">
              <MessageSquare size={32} strokeWidth={1.75} />
              <p>Ask the agent to manage reminders, notes, projects, or the kiosk.</p>
            </div>
          )}
          {turns.map((t, i) => (
            <div
              key={`${t.role}-${i}-${t.text.slice(0, 16)}`}
              className={`chat-page__bubble chat-page__bubble--${t.role}`}
            >
              <span className="chat-page__bubble-role">
                {t.role === "user" ? "You" : "OpenClaw"}
              </span>
              <p className="chat-page__bubble-text">{t.text}</p>
              {t.actionsTaken && t.actionsTaken.length > 0 && (
                <p className="chat-page__bubble-meta">
                  {t.actionsTaken.join(", ")}
                </p>
              )}
            </div>
          ))}
          {sending && (
            <div className="chat-page__bubble chat-page__bubble--agent chat-page__bubble--typing">
              <span className="chat-page__bubble-role">OpenClaw</span>
              <p className="chat-page__bubble-text">Thinking…</p>
            </div>
          )}
        </div>

        {error && <p className="voice-page__error">{error}</p>}

        <div className="chat-page__examples">
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              type="button"
              className="voice-page__chip"
              disabled={sending}
              onClick={() => void sendMessage(ex)}
            >
              {ex}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="chat-text">
          Message
        </label>
        <textarea
          id="chat-text"
          ref={inputRef}
          className="voice-page__input chat-page__input"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(draft);
            }
          }}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          disabled={sending}
        />

        <div className="voice-page__actions">
          <button
            type="button"
            className="action-card action-card--secondary"
            onClick={clearChat}
            disabled={sending || turns.length === 0}
          >
            <RotateCcw size={20} />
            Clear
          </button>
          <button
            type="button"
            className="action-card action-card--primary voice-page__send"
            onClick={() => void sendMessage(draft)}
            disabled={sending || !draft.trim()}
          >
            <Send size={22} />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
