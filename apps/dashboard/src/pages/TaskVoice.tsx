import { useNavigate } from "react-router-dom";

export default function TaskVoice() {
  const navigate = useNavigate();
  return (
    <div className="page-shell">
      <button type="button" className="back-btn" onClick={() => navigate("/")}>
        ← Back
      </button>
      <h1 className="page-title">Voice capture</h1>
      <p className="page-subtitle">
        Voice mode entry point — wire to your capture pipeline when ready.
      </p>
    </div>
  );
}
