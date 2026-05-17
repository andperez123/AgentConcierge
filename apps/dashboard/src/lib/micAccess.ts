export type MicAccessResult =
  | { ok: true }
  | { ok: false; error: string; recoverable: boolean };

/** Avoid opening getUserMedia on every listen (exclusive mics e.g. Seeed HAT on Pi). */
let micPreflightGranted = false;

export function resetMicPreflight(): void {
  micPreflightGranted = false;
}

async function queryMicPermission(): Promise<PermissionState | null> {
  if (!navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state;
  } catch {
    return null;
  }
}

/** Request mic permission once; later calls use Permissions API only (no second capture). */
export async function ensureMicrophoneAccess(
  force = false,
): Promise<MicAccessResult> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Not in a browser.", recoverable: false };
  }

  if (!window.isSecureContext) {
    return {
      ok: false,
      error:
        "Microphone needs a secure page. Use https:// or http://127.0.0.1 (not LAN IP over HTTP).",
      recoverable: false,
    };
  }

  if (!force && micPreflightGranted) {
    return { ok: true };
  }

  const perm = await queryMicPermission();
  if (!force && perm === "granted") {
    micPreflightGranted = true;
    return { ok: true };
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
    micPreflightGranted = true;
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
          "Microphone is busy. Turn off Voice mode briefly, wait a second, then tap Retry.",
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
      return "Microphone is busy. Wait a moment or tap Retry — Voice mode re-listens quickly on Pi.";
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

/** Pause so ALSA/Web Speech can release exclusive capture devices (e.g. Seeed WM8960). */
export function micReleaseDelay(ms = 600): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
