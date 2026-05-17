export type LocalVoiceAction =
  | { type: "stop" }
  | { type: "cancel" }
  | { type: "navigate"; to: string }
  | { type: "confirm" };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchLocalVoiceCommand(text: string): LocalVoiceAction | null {
  const n = normalize(text);
  if (!n) return null;

  if (
    n === "stop" ||
    n === "stop listening" ||
    n === "stop listen" ||
    n === "exit voice mode"
  ) {
    return { type: "stop" };
  }

  if (n === "cancel" || n === "never mind" || n === "nevermind") {
    return { type: "cancel" };
  }

  if (n === "go back" || n === "go home" || n === "home") {
    return { type: "navigate", to: "/" };
  }

  if (n === "open work" || n === "go to work" || n === "show work") {
    return { type: "navigate", to: "/work" };
  }

  if (
    n === "show projects" ||
    n === "open projects" ||
    n === "list projects"
  ) {
    return { type: "navigate", to: "/work?tab=projects" };
  }

  if (n === "confirm" || n === "yes" || n === "yes confirm") {
    return { type: "confirm" };
  }

  return null;
}
