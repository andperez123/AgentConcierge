import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Square, Send, Volume2, RotateCcw } from "lucide-react";
import { postVoiceCommand } from "../api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { voiceListenGapMs } from "../lib/kioskDevice";
import { releaseAudioForListening } from "../lib/micAccess";
import { matchLocalVoiceCommand } from "../voice/controlPhrases";
import {
  parseVoiceResult,
  type VoicePendingAction,
} from "../voice/parseVoiceResult";

const VOICE_MODE_KEY = "concierge-voice-mode";

type VoiceStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "confirming";

interface Turn {
  role: "you" | "agent";
  text: string;
  actionsTaken?: string[];
}

function loadVoiceMode(): boolean {
  try {
    return sessionStorage.getItem(VOICE_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveVoiceMode(on: boolean) {
  try {
    sessionStorage.setItem(VOICE_MODE_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const EXAMPLE_COMMANDS = [
  "Add reminder: check gateway logs",
  "Note: API key rotation Friday",
  "List my projects",
  "What is on my desk?",
];

export default function TaskVoice() {
  const navigate = useNavigate();
  const [voiceMode, setVoiceMode] = useState(loadVoiceMode);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [manual, setManual] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [pendingAction, setPendingAction] =
    useState<VoicePendingAction | null>(null);

  const statusRef = useRef(status);
  const voiceModeRef = useRef(voiceMode);
  const pendingRef = useRef(pendingAction);
  const abortRef = useRef<AbortController | null>(null);
  const scheduleListenRef = useRef<(() => void) | null>(null);
  const sendToAgentRef = useRef<
    (text: string, isConfirm: boolean) => Promise<void>
  >(async () => {});

  statusRef.current = status;
  voiceModeRef.current = voiceMode;
  pendingRef.current = pendingAction;

  const speech = useSpeechRecognition({
    onFinal: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const local = matchLocalVoiceCommand(trimmed);
      if (local) {
        if (local.type === "stop") {
          saveVoiceMode(false);
          setVoiceMode(false);
          setStatus("idle");
          setPendingAction(null);
          window.speechSynthesis?.cancel();
          abortRef.current?.abort();
          speech.stop();
          return;
        }
        if (local.type === "cancel") {
          setPendingAction(null);
          setStatus("idle");
          if (voiceModeRef.current) scheduleListenRef.current?.();
          return;
        }
        if (local.type === "navigate") {
          navigate(local.to);
          setStatus("idle");
          if (voiceModeRef.current) scheduleListenRef.current?.();
          return;
        }
        if (local.type === "confirm" && pendingRef.current) {
          const p = pendingRef.current;
          void sendToAgentRef.current(
            `User confirmed pending action: ${JSON.stringify(p)}`,
            true,
          );
          return;
        }
      }

      if (voiceModeRef.current) {
        if (
          statusRef.current === "thinking" ||
          statusRef.current === "speaking"
        ) {
          return;
        }
        void sendToAgentRef.current(trimmed, false);
      }
    },
  });

  const speak = useCallback(
    async (text: string): Promise<void> => {
      speech.stop();
      if (!speakReplies || !("speechSynthesis" in window)) {
        await releaseAudioForListening();
        return;
      }
      await new Promise<void>((resolve) => {
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      });
      await releaseAudioForListening();
    },
    [speakReplies, speech],
  );

  const sendToAgent = useCallback(
    async (text: string, isConfirm: boolean) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      speech.stop();
      setSendError(null);
      setStatus("thinking");
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setTurns((prev) => [...prev.slice(-5), { role: "you", text: trimmed }]);

      try {
        const result = await postVoiceCommand(trimmed);
        if (ac.signal.aborted) return;

        const parsed = parseVoiceResult(result.reply);
        const spoken = parsed.spokenText || result.reply;

        setTurns((prev) => [
          ...prev.slice(-5),
          {
            role: "agent",
            text: spoken,
            actionsTaken: parsed.voice?.actionsTaken,
          },
        ]);

        if (parsed.voice?.pendingAction) {
          setPendingAction(parsed.voice.pendingAction);
          setStatus("confirming");
        } else if (!isConfirm) {
          setPendingAction(null);
        }

        setStatus("speaking");
        await speak(spoken);
        if (ac.signal.aborted) return;

        if (parsed.navigateTo) {
          navigate(parsed.navigateTo);
        }

        speech.reset();
        setManual("");
        setStatus("idle");

        if (voiceModeRef.current) {
          scheduleListenRef.current?.();
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        setSendError(e instanceof Error ? e.message : "Send failed");
        setStatus("idle");
        if (voiceModeRef.current) scheduleListenRef.current?.();
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [navigate, speak, speech],
  );

  sendToAgentRef.current = sendToAgent;

  const startListening = useCallback(() => {
    if (
      statusRef.current === "thinking" ||
      statusRef.current === "speaking"
    ) {
      return;
    }
    setStatus("listening");
    void speech.start();
  }, [speech]);

  scheduleListenRef.current = () => {
    void (async () => {
      await releaseAudioForListening();
      window.setTimeout(() => {
        if (
          voiceModeRef.current &&
          statusRef.current !== "thinking" &&
          statusRef.current !== "speaking"
        ) {
          startListening();
        }
      }, voiceListenGapMs());
    })();
  };

  const speechRef = useRef(speech);
  speechRef.current = speech;

  useEffect(() => {
    saveVoiceMode(voiceMode);
    if (!voiceMode) {
      speechRef.current.releaseMic();
      abortRef.current?.abort();
      setStatus("idle");
      return;
    }
    scheduleListenRef.current?.();
  }, [voiceMode]);

  const draft = speech.transcript || manual;

  const sendManual = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const local = matchLocalVoiceCommand(text);
    if (local?.type === "navigate") {
      navigate(local.to);
      speech.reset();
      setManual("");
      return;
    }
    if (local?.type === "stop") {
      setVoiceMode(false);
      speech.reset();
      setManual("");
      return;
    }
    void sendToAgent(text, false);
  }, [draft, navigate, sendToAgent, speech]);

  function toggleListen() {
    if (status === "speaking" || status === "thinking") {
      window.speechSynthesis?.cancel();
      abortRef.current?.abort();
      setStatus("idle");
      startListening();
      return;
    }
    if (speech.listening) speech.stop();
    else startListening();
  }

  function toggleVoiceMode() {
    setVoiceMode((v) => !v);
    setPendingAction(null);
  }

  const statusLabel: Record<VoiceStatus, string> = {
    idle: voiceMode ? "Ready" : "Idle",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    confirming: "Confirm to proceed",
  };

  return (
    <div className="page-shell page-shell--voice">
      <header className="page-shell__header">
        <h1 className="page-title">Voice command</h1>
        <p className="page-subtitle voice-page__hint">
          Hands-free mode sends each phrase to OpenClaw. Prefer typing?{" "}
          <button
            type="button"
            className="voice-page__link"
            onClick={() => navigate("/task/chat")}
          >
            Open chat
          </button>
          . Desk items appear on{" "}
          <button
            type="button"
            className="voice-page__link"
            onClick={() => navigate("/work")}
          >
            Work
          </button>
          . Say &quot;stop listening&quot; to exit voice mode.
        </p>
      </header>

      <div className="page-shell__body">
      {!speech.supported && (
        <p className="voice-page__warn">
          Speech-to-text is not available in this browser. Type below or use
          Chromium on the Pi with microphone access.
        </p>
      )}

      {!window.isSecureContext && (
        <p className="voice-page__warn">
          This page is not a secure context. Use localhost or HTTPS for the
          microphone.
        </p>
      )}

      {speech.error && (
        <div className="voice-page__error-row">
          <p className="voice-page__error">{speech.error}</p>
          {speech.micRecoverable && (
            <>
              <button
                type="button"
                className="voice-page__retry"
                onClick={() => speech.retryMic()}
              >
                <RotateCcw size={18} />
                Retry mic
              </button>
              <button
                type="button"
                className="voice-page__retry"
                onClick={() => speech.releaseMic()}
              >
                Release mic
              </button>
            </>
          )}
        </div>
      )}
      {sendError && <p className="voice-page__error">{sendError}</p>}

      <label className="voice-page__toggle voice-page__toggle--mode">
        <input
          type="checkbox"
          checked={voiceMode}
          onChange={toggleVoiceMode}
        />
        <span>Voice mode (hands-free)</span>
      </label>

      <p
        className={`voice-page__status voice-page__status--${status}`}
        aria-live="polite"
      >
        {statusLabel[status]}
      </p>

      <div className="voice-page__mic-wrap">
        <button
          type="button"
          className={`voice-page__mic${speech.listening ? " voice-page__mic--active" : ""}`}
          onClick={toggleListen}
          disabled={!speech.supported || status === "thinking"}
          aria-label={speech.listening ? "Stop listening" : "Start listening"}
        >
          {speech.listening ? (
            <Square size={40} strokeWidth={2.5} />
          ) : (
            <Mic size={44} strokeWidth={2.5} />
          )}
        </button>
        <p className="voice-page__mic-label">
          {voiceMode
            ? speech.listening
              ? "Listening… tap to interrupt"
              : "Voice mode on — speak when ready"
            : speech.listening
              ? "Listening… tap to stop"
              : "Tap to speak"}
        </p>
      </div>

      <div className="voice-page__examples">
        {EXAMPLE_COMMANDS.map((ex) => (
          <button
            key={ex}
            type="button"
            className="voice-page__chip"
            disabled={status === "thinking" || status === "speaking"}
            onClick={() => {
              if (voiceMode) void sendToAgent(ex, false);
              else {
                setManual(ex);
                speech.reset();
              }
            }}
          >
            {ex}
          </button>
        ))}
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
        placeholder="e.g. Add reminder: check gateway tomorrow"
        disabled={status === "thinking"}
      />

      <div className="voice-page__actions">
        <button
          type="button"
          className="action-card action-card--secondary"
          onClick={() => navigate("/")}
          disabled={status === "thinking"}
        >
          Cancel
        </button>
        <button
          type="button"
          className="action-card action-card--primary voice-page__send"
          onClick={() => void sendManual()}
          disabled={
            status === "thinking" ||
            status === "speaking" ||
            !draft.trim()
          }
        >
          <Send size={22} />
          {status === "thinking" ? "Sending…" : "Send"}
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

      {turns.length > 0 && (
        <div className="voice-page__log">
          <p className="voice-page__log-title">Recent</p>
          <ul className="voice-page__log-list">
            {turns.slice(-6).map((t, i) => (
              <li
                key={`${t.role}-${i}-${t.text.slice(0, 12)}`}
                className={`voice-page__log-item voice-page__log-item--${t.role}`}
              >
                <span className="voice-page__log-role">
                  {t.role === "you" ? "You" : "OpenClaw"}
                </span>
                <span className="voice-page__log-text">{t.text}</span>
                {t.actionsTaken && t.actionsTaken.length > 0 && (
                  <span className="voice-page__log-actions">
                    {t.actionsTaken.join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </div>
  );
}
