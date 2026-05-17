import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureMicrophoneAccess,
  mapSpeechRecognitionError,
} from "../lib/micAccess";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechRecognitionOptions {
  /** Fired when an utterance ends with non-empty final text. */
  onFinal?: (text: string) => void;
}

export function useSpeechRecognition(options?: UseSpeechRecognitionOptions) {
  const onFinalRef = useRef(options?.onFinal);
  onFinalRef.current = options?.onFinal;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [micRecoverable, setMicRecoverable] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sessionFinalRef = useRef("");
  const interimRef = useRef("");
  const startingRef = useRef(false);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    startingRef.current = false;
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || listening) return;

    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition is not supported in this browser.");
      setMicRecoverable(false);
      return;
    }

    startingRef.current = true;
    setError(null);
    setMicRecoverable(false);
    setInterim("");
    interimRef.current = "";
    sessionFinalRef.current = "";

    const mic = await ensureMicrophoneAccess();
    if (!mic.ok) {
      setError(mic.error);
      setMicRecoverable(mic.recoverable);
      startingRef.current = false;
      return;
    }

    recognitionRef.current?.abort();

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      startingRef.current = false;
    };

    rec.onend = () => {
      setListening(false);
      startingRef.current = false;
      recognitionRef.current = null;

      const finalText = sessionFinalRef.current.trim();
      const withInterim = interimRef.current.trim();
      const combined = finalText || withInterim;
      sessionFinalRef.current = "";
      setInterim("");

      if (combined) {
        onFinalRef.current?.(combined);
      }
    };

    rec.onerror = (ev) => {
      setListening(false);
      startingRef.current = false;
      recognitionRef.current = null;

      const msg = mapSpeechRecognitionError(ev.error);
      if (msg) {
        setError(msg);
        setMicRecoverable(
          ev.error === "audio-capture" ||
            ev.error === "not-allowed" ||
            ev.error === "network",
        );
      }
    };

    rec.onresult = (ev) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const part = ev.results[i]![0]?.transcript ?? "";
        if (ev.results[i]!.isFinal) finalChunk += part;
        else interimChunk += part;
      }
      if (finalChunk) {
        sessionFinalRef.current = `${sessionFinalRef.current}${finalChunk}`.trim();
        setTranscript(sessionFinalRef.current);
        setInterim("");
      } else if (interimChunk) {
        interimRef.current = interimChunk;
        setInterim(interimChunk);
      }
    };

    try {
      rec.start();
    } catch (e) {
      setListening(false);
      startingRef.current = false;
      recognitionRef.current = null;
      setError(e instanceof Error ? e.message : "Could not start listening");
      setMicRecoverable(true);
    }
  }, [listening]);

  const reset = useCallback(() => {
    stop();
    setTranscript("");
    setInterim("");
    interimRef.current = "";
    sessionFinalRef.current = "";
    setError(null);
    setMicRecoverable(false);
  }, [stop]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const displayText = `${transcript}${interim ? (transcript ? " " : "") + interim : ""}`.trim();

  return {
    supported,
    listening,
    transcript: displayText,
    finalTranscript: transcript,
    interim,
    error,
    micRecoverable,
    start,
    stop,
    reset,
  };
}
