export type MicAccessResult =
  | { ok: true }
  | { ok: false; error: string; recoverable: boolean };

/** Request mic permission before Web Speech API (fixes many audio-capture errors). */
export async function ensureMicrophoneAccess(): Promise<MicAccessResult> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Not in a browser.", recoverable: false };
  }

  if (!window.isSecureContext) {
    return {
      ok: false,
      error:
        "Microphone needs a secure page. Use https:// or http://localhost (not LAN IP over HTTP).",
      recoverable: false,
    };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      error: "Microphone API is not available. Use Chromium on the kiosk.",
      recoverable: false,
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return { ok: true };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return {
        ok: false,
        error:
          "Microphone permission denied. Allow the mic in site settings, then tap Retry.",
        recoverable: true,
      };
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return {
        ok: false,
        error: "No microphone found. Check system sound settings.",
        recoverable: false,
      };
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return {
        ok: false,
        error:
          "Microphone is in use by another app. Close it, then tap Retry.",
        recoverable: true,
      };
    }
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Could not access the microphone.",
      recoverable: true,
    };
  }
}

export function mapSpeechRecognitionError(code: string): string {
  switch (code) {
    case "not-allowed":
      return "Microphone permission denied. Allow the mic in site settings, then tap Retry.";
    case "audio-capture":
      return "Could not capture audio. Check the mic is connected and not in use, then tap Retry.";
    case "no-speech":
      return "No speech heard. Try again closer to the mic.";
    case "network":
      return "Speech recognition needs network access. Check connectivity.";
    case "aborted":
      return "";
    case "service-not-allowed":
      return "Speech recognition is blocked for this page. Use Chromium with microphone access.";
    default:
      return `Speech error: ${code}`;
  }
}
