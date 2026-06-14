import { useState } from "react";
import type { WorkEntityKind } from "@concierge/shared";
import { fetchOperation, postWorkEntityAction } from "../api";

const QUICK_ACTIONS = [
  {
    id: "ask-agent",
    label: "Ask Agent",
    prompt:
      "The operator wants you to handle this work item. Take the next concrete step and reply with what you did or recommend.",
  },
  {
    id: "break-into-tasks",
    label: "Break Into Tasks",
    prompt:
      "Break this work item into 3–7 concrete, actionable tasks. Return a numbered list only.",
  },
  {
    id: "draft-plan",
    label: "Draft Plan",
    prompt:
      "Draft a short execution plan for this work item: goal, steps, and estimated effort.",
  },
  {
    id: "schedule-time",
    label: "Schedule Time",
    prompt:
      "Suggest when to work on this item based on urgency. Propose specific time blocks for the next few days.",
  },
] as const;

interface Props {
  kind: WorkEntityKind;
  id: string;
  /** Only show for work-context items */
  context?: "work" | "life" | null;
  onComplete?: () => void;
}

export default function AgentQuickActions({
  kind,
  id,
  context,
  onComplete,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    tone: "idle" | "running" | "success" | "error";
    message: string;
  }>({ tone: "idle", message: "" });

  if (context !== "work") return null;

  async function runAction(prompt: string, label: string) {
    setBusy(true);
    setStatus({ tone: "running", message: `${label}…` });
    try {
      const op = await postWorkEntityAction(kind, id, {
        action: "ask-agent",
        options: { prompt },
      });
      let message = "Agent accepted the task";
      if (op.operationId) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const result = await fetchOperation(op.operationId);
          if (
            result.state === "succeeded" ||
            result.state === "failed" ||
            result.state === "timed_out"
          ) {
            message =
              result.message ??
              (result.state === "succeeded" ? "Agent finished" : "Agent failed");
            break;
          }
        }
      }
      setStatus({ tone: "success", message });
      onComplete?.();
    } catch (e) {
      setStatus({
        tone: "error",
        message: e instanceof Error ? e.message : "Action failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-quick-actions">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          className="agent-quick-actions__btn"
          disabled={busy}
          onClick={() => void runAction(action.prompt, action.label)}
        >
          {action.label}
        </button>
      ))}
      {status.tone !== "idle" && (
        <p
          className={`agent-quick-actions__status${
            status.tone === "success"
              ? " agent-quick-actions__status--success"
              : status.tone === "error"
                ? " agent-quick-actions__status--error"
                : ""
          }`}
          role="status"
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
