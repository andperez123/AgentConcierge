import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Reminder } from "@concierge/shared";
import { fetchReminder } from "../api";
import DeskItemDetail from "../components/DeskItemDetail";

export default function ReminderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const numId = Number(id);
    if (!Number.isFinite(numId)) {
      setError("Invalid reminder");
      return;
    }
    try {
      setReminder(await fetchReminder(numId));
      setError(null);
    } catch {
      setReminder(null);
      setError("Reminder not found");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="app-kiosk desk-detail">
        <p className="desk-detail__error">{error}</p>
        <button
          type="button"
          className="action-card action-card--secondary"
          onClick={() => navigate("/reminders")}
        >
          Back to reminders
        </button>
      </div>
    );
  }

  if (!reminder) {
    return (
      <div className="app-kiosk desk-detail">
        <p className="reminder-empty">Loading…</p>
      </div>
    );
  }

  return (
    <DeskItemDetail
      kind="reminder"
      item={reminder}
      onChanged={() => void load()}
    />
  );
}
