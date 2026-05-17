import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Square, Send, Volume2 } from "lucide-react";
import { postVoiceCommand } from "../api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

export default function TaskVoice() {
  const navigate = useNavigate();
  const speech = useSpeechRecognition();
  const [manual, setManual] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(true);

  const draft = speech.transcript || manual;

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setSendError(null);
    setReply(null);
    try {
      const result = await postVoiceCommand(text);
      setReply(result.reply);
      if (speakReplies && "speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(result.reply);
        utter.rate = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      }
      speech.reset();
      setManual("");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }, [draft, speakReplies, speech]);

  function toggleListen() {
    if (speech.listening) speech.stop();
    else speech.start();
  }

  return (
    <div className="page-shell page-shell--voice">
      <h1 className="page-title">Voice command</h1>
      <p className="page-subtitle voice-page__hint">
        Tap the mic and speak, or type below. Sends to OpenClaw via{" "}
        <code className="voice-page__code">openclaw agent --message</code>.
      </p>

      {!speech.supported && (
        <p className="voice-page__warn">
          Speech-to-text is not available in this browser. Type your command
          below, or use Chromium on the Pi with microphone access.
        </p>
      )}

      {speech.error && <p className="voice-page__error">{speech.error}</p>}
      {sendError && <p className="voice-page__error">{sendError}</p>}

      <div className="voice-page__mic-wrap">
        <button
          type="button"
          className={`voice-page__mic${speech.listening ? " voice-page__mic--active" : ""}`}
          onClick={toggleListen}
          disabled={!speech.supported || sending}
          aria-label={speech.listening ? "Stop listening" : "Start listening"}
        >
          {speech.listening ? (
            <Square size={40} strokeWidth={2.5} />
          ) : (
            <Mic size={44} strokeWidth={2.5} />
          )}
        </button>
        <p className="voice-page__mic-label">
          {speech.listening ? "Listening… tap to stop" : "Tap to speak"}
        </p>
      </div>

      <label className="field-label" htmlFor="voice-text">
        Command
      </label>
      <textarea
        id="voice-text"
        className="voice-page__input"
        rows={3}
        value={speech.transcript ? speech.transcript : manual}
        onChange={(e) => {
          if (speech.transcript) speech.reset();
          setManual(e.target.value);
        }}
        placeholder="e.g. What is the gateway status?"
        disabled={sending}
      />

      <div className="voice-page__actions">
        <button
          type="button"
          className="action-card action-card--secondary"
          onClick={() => navigate("/")}
          disabled={sending}
        >
          Cancel
        </button>
        <button
          type="button"
          className="action-card action-card--primary voice-page__send"
          onClick={() => void send()}
          disabled={sending || !draft.trim()}
        >
          <Send size={22} />
          {sending ? "Sending…" : "Send to OpenClaw"}
        </button>
      </div>

      <label className="voice-page__toggle">
        <input
          type="checkbox"
          checked={speakReplies}
          onChange={(e) => setSpeakReplies(e.target.checked)}
        />
        <Volume2 size={20} />
        <span>Read replies aloud</span>
      </label>

      {reply && (
        <div className="voice-page__reply dash-card">
          <p className="voice-page__reply-label">OpenClaw</p>
          <p className="voice-page__reply-text">{reply}</p>
        </div>
      )}
    </div>
  );
}
