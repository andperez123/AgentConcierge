import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    setError(null);
    setInterim("");
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === "not-allowed") {
        setError("Microphone permission denied.");
      } else if (ev.error !== "aborted") {
        setError(`Speech error: ${ev.error}`);
      }
    };
    rec.onresult = (ev) => {
      let finalText = "";
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const part = ev.results[i]![0]?.transcript ?? "";
        if (ev.results[i]!.isFinal) finalText += part;
        else interimText += part;
      }
      if (finalText) {
        setTranscript((prev) => `${prev}${finalText}`.trim());
        setInterim("");
      } else {
        setInterim(interimText);
      }
    };

    try {
      rec.start();
    } catch (e) {
      setListening(false);
      setError(e instanceof Error ? e.message : "Could not start listening");
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript("");
    setInterim("");
    setError(null);
  }, [stop]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const displayText = `${transcript}${interim ? (transcript ? " " : "") + interim : ""}`.trim();

  return {
    supported,
    listening,
    transcript: displayText,
    error,
    start,
    stop,
    reset,
  };
}
