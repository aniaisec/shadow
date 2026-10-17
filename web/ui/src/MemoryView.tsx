import { useEffect, useRef, useState } from "react";
import type { ActivityRow, DecisionRow } from "./types";
import { api } from "./api";
import { Chip, Icon, ICONS, relTime } from "./ui";

const PIPELINE = [
  { step: "observe", label: "Observe", sub: "Box webhook", icon: '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>' },
  { step: "remember", label: "Remember", sub: "Box AI + metadata", icon: ICONS.layers },
  { step: "protect", label: "Protect", sub: "Box permissions", icon: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>' },
  { step: "answer", label: "Answer", sub: "AWS agents", icon: ICONS.chat },
];
const AGENT_STEP: Record<string, string> = {
  Webhook: "observe", Librarian: "remember", Scribe: "remember",
  Cartographer: "remember", Answer: "answer",
};

export function MemoryView() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const prevTop = useRef<string | null>(null);

  const loadActivity = async () => {
    try { setRows((await api.activity()).rows); } catch { /* ignore */ }
  };
  const loadDecisions = async () => {
    try { setDecisions((await api.decisions()).rows); } catch { /* ignore */ }
  };

  useEffect(() => {
    loadActivity(); loadDecisions();
    const t = setInterval(loadActivity, 2000);
    return () => clearInterval(t);
  }, []);

  const running = rows[0] ? AGENT_STEP[rows[0].agent] : undefined;
  const topTs = rows[0]?.ts ?? null;

  const run = async (which: "ingest" | "confirm") => {
    setBusy(which); setResult("");
    try {
      const r = which === "ingest" ? await api.ingest() : await api.confirmTask();
      setResult(r.ok === false ? "Failed: " + (r.error ?? "") : which === "ingest" ? "Ingestion started" : "Task completed");
      await loadActivity(); await loadDecisions();
    } catch { setResult("Failed"); }
    finally { setBusy(null); }
  };

  const enterTop = topTs !== prevTop.current;
  prevTop.current = topTs;

  return (
    <div className="view-memory-inner memory-scroll">
      <header className="memory-header">
        <h1>Team memory</h1>
        <p>What Shadow has learned from the Payments team, and what it's doing right now.</p>
      </header>

      <div className="pipeline">
        {PIPELINE.map((p, i) => (
          <>
            <div key={p.step} className={"pstep" + (running === p.step ? " running" : "")} data-step={p.step}>
              <Icon d={p.icon} sm />{p.label}<small>{p.sub}</small>
            </div>
            {i < PIPELINE.length - 1 && <span key={"a" + i} className="arrow">→</span>}
          </>
        ))}
      </div>

      <div className="memory-cols">
        <div className="card activity-card">
          <div className="card-head">
            <h3>Live activity</h3>
            <span className="live-dot show"><span className="dot" />Updating</span>
          </div>
          <ul className="activity-list">
            {rows.map((r, i) => (
              <li key={r.ts} className={"activity-row" + (i === 0 && enterTop ? " enter" : "")}>
                <span className={"badge " + r.agent}>{r.agent}</span>
                <span className="act">{r.action}</span>
                <span className="time">{relTime(r.ts)}</span>
              </li>
            ))}
            {rows.length === 0 && <li className="activity-row"><span className="act" style={{ color: "var(--muted)" }}>No activity yet — ingest the Oct 17 standup to see the agents run.</span></li>}
          </ul>
        </div>

        <div className="card decisions-card">
          <div className="card-head"><h3>Decisions</h3></div>
          <table className="decisions-table">
            <thead><tr><th>Decision</th><th>Status</th><th>Owner</th><th>Confirmed</th></tr></thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.file_id} onClick={() => window.open(d.box_url, "_blank")}>
                  <td>{d.decision || d.name}</td>
                  <td><Chip ds={{ decision: "", status: d.status, confirmed: d.confirmed, decidedOn: "" }} /></td>
                  <td>{(d.owners || "").split("@")[0]}</td>
                  <td>{d.confirmed === "pending"
                    ? <span className="wait-pill">Waiting on Dana</span>
                    : d.confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="demo-controls">
        <span className="demo-label">Demo controls</span>
        <button className="btn-secondary" disabled={!!busy} onClick={() => run("ingest")}>
          {busy === "ingest" && <span className="spinner" />}Ingest latest file
        </button>
        <button className="btn-secondary" disabled={!!busy} onClick={() => run("confirm")}>
          {busy === "confirm" && <span className="spinner" />}Simulate Dana confirming
        </button>
        <span className="demo-result">{result}</span>
      </div>
    </div>
  );
}
