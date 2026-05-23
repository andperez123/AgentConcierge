import { useCallback, useEffect, useRef, useState } from "react";
import {
  isKioskHardware,
  micCaptureRetryDelayMs,
  micReleaseDelayMs,
} from "../lib/kioskDevice";
import {
  ensureMicrophoneAccess,
  mapSpeechRecognitionError,
  micReleaseDelay,
  releaseAudioForListening,
  resetMicPreflight,
} from "../lib/micAccess";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Serialize mic start/stop so Pi ALSA never sees overlapping capture. */
let micOpChain: Promise<void> = Promise.resolve();

function enqueueMicOp<T>(fn: () => Promise<T>): Promise<T> {
  const run = micOpChain.then(fn, fn);
  micOpChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
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
  const listeningRef = useRef(false);
  const intentionalTeardownRef = useRef(false);
  const releaseWaitRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const waitForMicRelease = useCallback(async () => {
    if (releaseWaitRef.current) {
      await releaseWaitRef.current;
      releaseWaitRef.current = null;
    }
    await micReleaseDelay(micReleaseDelayMs());
  }, []);

  const teardownRecognition = useCallback(
    (opts?: { scheduleRelease?: boolean }) => {
      intentionalTeardownRef.current = true;
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          try {
            rec.stop();
          } catch {
            /* ignore */
          }
        }
      }
      recognitionRef.current = null;
      listeningRef.current = false;
      setListening(false);
      startingRef.current = false;
      queueMicrotask(() => {
        intentionalTeardownRef.current = false;
      });
      if (opts?.scheduleRelease !== false) {
        releaseWaitRef.current = micReleaseDelay(micReleaseDelayMs());
      }
    },
    [],
  );

  const stop = useCallback(() => {
    teardownRecognition();
  }, [teardownRecognition]);

  const runStart = useCallback(
    async (opts?: { forceMicPreflight?: boolean; captureAttempt?: number }) => {
      const captureAttempt = opts?.captureAttempt ?? 0;

      if (startingRef.current || listeningRef.current) return;

      if (releaseWaitRef.current) {
        await releaseWaitRef.current;
        releaseWaitRef.current = null;
      }

      await releaseAudioForListening();
      teardownRecognition();
      await waitForMicRelease();

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

      const mic = await ensureMicrophoneAccess(opts?.forceMicPreflight ?? false);
      if (!mic.ok) {
        setError(mic.error);
        setMicRecoverable(mic.recoverable);
        startingRef.current = false;
        return;
      }

      const rec = new Ctor();
      recognitionRef.current = rec;
      rec.lang = "en-US";
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        listeningRef.current = true;
        setListening(true);
        startingRef.current = false;
      };

      rec.onend = () => {
        if (intentionalTeardownRef.current) return;

        listeningRef.current = false;
        setListening(false);
        startingRef.current = false;
        recognitionRef.current = null;
        releaseWaitRef.current = micReleaseDelay(micReleaseDelayMs());

        const finalText = sessionFinalRef.current.trim();
        const withInterim = interimRef.current.trim();
        const combined = finalText || withInterim;
        sessionFinalRef.current = "";
        setInterim("");

        if (combined) {
          onFinalRef.current?.(combined);
        }
      };

      rec.onerror = async (ev) => {
        if (intentionalTeardownRef.current) return;

        listeningRef.current = false;
        setListening(false);
        startingRef.current = false;
        recognitionRef.current = null;
        releaseWaitRef.current = micReleaseDelay(micReleaseDelayMs());

        if (ev.error === "aborted") return;

        const kiosk = isKioskHardware();
        if (
          ev.error === "audio-capture" &&
          kiosk &&
          captureAttempt < 3
        ) {
          await micReleaseDelay(
            micCaptureRetryDelayMs(captureAttempt + 1),
          );
          void enqueueMicOp(() =>
            runStart({
              forceMicPreflight: false,
              captureAttempt: captureAttempt + 1,
            }),
          );
          return;
        }

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
          sessionFinalRef.current =
            `${sessionFinalRef.current}${finalChunk}`.trim();
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
        listeningRef.current = false;
        setListening(false);
        startingRef.current = false;
        recognitionRef.current = null;
        releaseWaitRef.current = micReleaseDelay(micReleaseDelayMs());

        const kiosk = isKioskHardware();
        if (kiosk && captureAttempt < 3) {
          await micReleaseDelay(micCaptureRetryDelayMs(captureAttempt + 1));
          void enqueueMicOp(() =>
            runStart({
              forceMicPreflight: false,
              captureAttempt: captureAttempt + 1,
            }),
          );
          return;
        }

        setError(e instanceof Error ? e.message : "Could not start listening");
        setMicRecoverable(true);
      }
    },
    [teardownRecognition, waitForMicRelease],
  );

  const start = useCallback(
    (opts?: { forceMicPreflight?: boolean }) =>
      enqueueMicOp(() => runStart(opts)),
    [runStart],
  );

  const retryMic = useCallback(() => {
    resetMicPreflight();
    const force = !isKioskHardware();
    void start({ forceMicPreflight: force });
  }, [start]);

  const releaseMic = useCallback(() => {
    void enqueueMicOp(async () => {
      stop();
      resetMicPreflight();
      await releaseAudioForListening();
      await waitForMicRelease();
      setError(null);
      setMicRecoverable(false);
    });
  }, [stop, waitForMicRelease]);

  const reset = useCallback(() => {
    stop();
    setTranscript("");
    setInterim("");
    interimRef.current = "";
    sessionFinalRef.current = "";
    setError(null);
    setMicRecoverable(false);
  }, [stop]);

  useEffect(
    () => () => {
      intentionalTeardownRef.current = true;
      recognitionRef.current?.abort();
    },
    [],
  );

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
    retryMic,
    releaseMic,
    reset,
  };
}
