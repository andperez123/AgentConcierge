import { isAllowedKioskRoute } from "@concierge/shared";

const MARKER_START = "VOICE_RESULT_JSON:";
const MARKER_END = "END_VOICE_RESULT_JSON";

export interface VoicePendingAction {
  kind?: string;
  id?: number | string;
  [key: string]: unknown;
}

export interface VoiceResultPayload {
  spokenReply?: string;
  actionsTaken?: string[];
  navigateTo?: string | null;
  pendingAction?: VoicePendingAction | null;
}

export interface ParsedVoiceReply {
  voice: VoiceResultPayload | null;
  spokenText: string;
  navigateTo: string | null;
}

export function isAllowedVoiceRoute(route: string): boolean {
  return isAllowedKioskRoute(route);
}

function extractBetweenMarkers(reply: string): {
  jsonRaw: string | null;
  before: string;
} {
  const startIdx = reply.indexOf(MARKER_START);
  if (startIdx === -1) {
    return { jsonRaw: null, before: reply.trim() };
  }
  const afterStart = reply.slice(startIdx + MARKER_START.length);
  const endIdx = afterStart.indexOf(MARKER_END);
  const before = reply.slice(0, startIdx).trim();
  if (endIdx === -1) {
    return { jsonRaw: null, before };
  }
  return {
    jsonRaw: afterStart.slice(0, endIdx).trim(),
    before,
  };
}

function stripMarkers(text: string): string {
  const startIdx = text.indexOf(MARKER_START);
  if (startIdx !== -1) return text.slice(0, startIdx).trim();
  return text;
}

export function parseVoiceResult(reply: string): ParsedVoiceReply {
  const { jsonRaw, before } = extractBetweenMarkers(reply);

  if (!jsonRaw) {
    return {
      voice: null,
      spokenText: stripMarkers(reply).trim() || reply.trim(),
      navigateTo: null,
    };
  }

  try {
    const voice = JSON.parse(jsonRaw) as VoiceResultPayload;
    const spoken =
      typeof voice.spokenReply === "string" && voice.spokenReply.trim()
        ? voice.spokenReply.trim()
        : before || stripMarkers(reply).trim();

    const rawNav =
      typeof voice.navigateTo === "string" ? voice.navigateTo.trim() : "";
    const navigateTo =
      rawNav && isAllowedVoiceRoute(rawNav) ? rawNav : null;

    return { voice, spokenText: spoken, navigateTo };
  } catch {
    return {
      voice: null,
      spokenText: before || stripMarkers(reply).trim() || reply.trim(),
      navigateTo: null,
    };
  }
}

export function formatMockVoiceReply(
  spokenReply: string,
  extras: Partial<VoiceResultPayload> = {},
): string {
  const payload: VoiceResultPayload = {
    spokenReply,
    actionsTaken: extras.actionsTaken ?? ["mock"],
    navigateTo: extras.navigateTo ?? null,
    pendingAction: extras.pendingAction ?? null,
  };
  return `${spokenReply}\n\n${MARKER_START}\n${JSON.stringify(payload, null, 2)}\n${MARKER_END}`;
}
