import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GoogleAuthStatus, Operation } from "@concierge/shared";
import {
  fetchGoogleAuthStatus,
  fetchOperation,
  runGoogleReauth,
} from "../api";
import GoogleAuthCard from "../components/GoogleAuthCard";

const DRIVE_URL = "https://drive.google.com";

function pollOperation(id: string): Promise<Operation> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const op = await fetchOperation(id);
        if (
          op.state === "succeeded" ||
          op.state === "failed" ||
          op.state === "timed_out" ||
          op.state === "canceled"
        ) {
          resolve(op);
          return;
        }
        if (attempts > 90) {
          reject(new Error("Reauth timed out"));
          return;
        }
        window.setTimeout(() => void tick(), 1000);
      } catch (e) {
        reject(e);
      }
    };
    void tick();
  });
}

export default function TaskReauth() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleAuthStatus | null>(
    null,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refreshGoogle = useCallback(async (force = false) => {
    try {
      setGoogleStatus(await fetchGoogleAuthStatus(force));
    } catch {
      setGoogleStatus(null);
    }
  }, []);

  useEffect(() => {
    void refreshGoogle();
  }, [refreshGoogle]);

  async function start() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const accepted = await runGoogleReauth();
      if (!accepted.operationId) {
        throw new Error("Reauth did not return an operation id");
      }
      setMsg("Reauth running on the Pi…");
      const op = await pollOperation(accepted.operationId);
      await refreshGoogle(true);
      if (op.state === "succeeded") {
        setMsg(op.message ?? "Google connected. Drive export is available from Work.");
      } else {
        setErr(
          op.message ??
            op.error ??
            "Reauth failed — check SSH on the Pi for openclaw prompts",
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reauth failed");
    } finally {
      setBusy(false);
    }
  }

  const connected = googleStatus?.state === "connected";

  return (
    <div className="page-shell page-shell--reauth">
      <header className="page-shell__header">
        <button type="button" className="back-btn" onClick={() => navigate("/")}>
          ← Back
        </button>
        <h1 className="page-title">Google &amp; Drive</h1>
        <p className="page-subtitle">
          Connect Google so OpenClaw can save desk items to Drive
        </p>
      </header>

      <div className="page-shell__body">
        <GoogleAuthCard
          status={googleStatus ?? undefined}
          onRefresh={() => void refreshGoogle(true)}
          onReauth={() => void start()}
          reauthBusy={busy}
          loading={busy}
        />

        <ol className="task-steps">
          <li>Tap Reauthenticate Google below (or on the card).</li>
          <li>
            If the Pi shows a device code in SSH, complete sign-in in a browser.
          </li>
          <li>
            When connected, use <strong>Save to Drive</strong> on reminders, notes,
            or projects in Work.
          </li>
        </ol>

        <button
          type="button"
          className="action-card action-card--primary"
          disabled={busy}
          onClick={() => void start()}
        >
          {busy ? "Running on Pi…" : "Reauthenticate Google"}
        </button>

        {connected && (
          <a
            href={DRIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="action-card action-card--secondary google-reauth__drive"
          >
            Open Google Drive
          </a>
        )}

        {msg && <p className="field-success">{msg}</p>}
        {err && <p className="field-error">{err}</p>}

        <p className="page-subtitle google-reauth__hint">
          Kiosk uses <code>http://127.0.0.1:3080</code> so Google and the mic work.
          LAN IP over plain HTTP blocks both.
        </p>
      </div>
    </div>
  );
}
