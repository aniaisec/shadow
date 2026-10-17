import type { ActingAs, Sources } from "./types";
import { Icon, ICONS, ShadowMark, initials } from "./ui";

export function Sidebar({
  view, setView, sources, actingAs, onSwitch,
}: {
  view: string;
  setView: (v: "ask" | "memory") => void;
  sources: Sources | null;
  actingAs: ActingAs | null;
  onSwitch: (name: string) => void;
}) {
  const navItem = (id: "ask" | "memory", icon: string, label: string) => (
    <button
      className={"nav-item" + (view === id ? " active" : "")}
      aria-current={view === id ? "page" : "false"}
      onClick={() => setView(id)}
    >
      <Icon d={icon} />
      <span>{label}</span>
    </button>
  );

  const row = (icon: string, label: string, count: number | string) => (
    <li>
      <Icon d={icon} sm />
      <span>{label}</span>
      <em>{count}</em>
    </li>
  );

  return (
    <aside className="panel sidebar" aria-label="Navigation">
      <div className="logo-row">
        <ShadowMark size={34} />
        <span className="wordmark">SHADOW</span>
      </div>
      <div className="divider-soft" />

      <nav className="nav" aria-label="Primary">
        {navItem("ask", ICONS.chat, "Ask Shadow")}
        {navItem("memory", ICONS.layers, "Team memory")}
      </nav>

      <div className="shadowing">
        <div className="section-label">
          Shadowing
          {sources?.live && (
            <span className="live-dot"><span className="dot" />Live</span>
          )}
        </div>
        <ul className="source-list">
          {row(ICONS.meeting, "Meetings", sources?.meetings ?? "—")}
          {row(ICONS.slack, "Slack channels", sources?.slack ?? "—")}
          {row(ICONS.issue, "Issues and PRs", sources?.issues_prs ?? "—")}
          {row(ICONS.doc, "Docs in Box", sources?.docs ?? "—")}
        </ul>
      </div>

      <div className="sidebar-bottom">
        <div className="divider-soft" />
        <label className="acting-label" htmlFor="acting-as">Acting as</label>
        <select
          id="acting-as"
          className="acting-select"
          value={actingAs?.name ?? ""}
          onChange={(e) => onSwitch(e.target.value)}
        >
          {actingAs?.options.map((o) => (
            <option key={o.name} value={o.name}>{o.name}</option>
          ))}
        </select>
        <div className="user-chip">
          <span className="avatar">
            {actingAs?.meta.initials ?? (actingAs ? initials(actingAs.name) : "")}
          </span>
          <div>
            <div className="user-name">{actingAs?.name}</div>
            <div className="user-sub">{actingAs?.meta.subtitle}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
