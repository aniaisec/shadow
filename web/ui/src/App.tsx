import { useEffect, useMemo, useRef, useState } from "react";
import type { ActingAs, Answer, QItem, Sources } from "./types";
import { api } from "./api";
import { Icon, ICONS, ShadowMark } from "./ui";
import { Sidebar } from "./Sidebar";
import { AnswerView, Thinking } from "./AnswerView";
import { MemoryView } from "./MemoryView";

const SUGGESTIONS = [
  { t: "Explain my assigned issue, PAY-482", bg: "var(--accent-tint)", fg: "var(--accent)", ic: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/>' },
  { t: "What did the team decide about retries?", bg: "var(--teal-tint)", fg: "var(--teal)", ic: '<rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="8 12 11 15 16 9"/>' },
  { t: "Who should I ask about the ledger?", bg: "var(--amber-tint)", fg: "var(--amber)", ic: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><line x1="19" y1="7" x2="19" y2="13"/><line x1="16" y1="10" x2="22" y2="10"/>' },
  { t: "What's the plan for the checkout flash-sale timeouts?", bg: "var(--teal-tint)", fg: "var(--teal)", ic: '<rect x="2" y="5" width="15" height="14" rx="2"/><polygon points="17 9 22 6 22 18 17 15"/>' },
  { t: "How does the ledger webhook work and what did we fix?", bg: "var(--accent-tint)", fg: "var(--accent)", ic: ICONS.layers },
  { t: "Who is my onboarding buddy and where do I start?", bg: "var(--green-tint)", fg: "var(--green)", ic: ICONS.people },
  { t: "How does this team review pull requests?", bg: "var(--accent-tint)", fg: "var(--accent)", ic: ICONS.doc },
  { t: "What changed after the September reorg?", bg: "var(--amber-tint)", fg: "var(--amber)", ic: '<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 8 8 8"/>' },
  { t: "What did we decide about the gateway vendor pricing contract?", bg: "var(--red-tint)", fg: "var(--red)", ic: ICONS.lock },
];

// follow-up chips shown under an answer, to drive the demo forward interactively
const FOLLOWUPS: { match: RegExp; chips: string[] }[] = [
  { match: /pay-482|retry|retries|idempoten/i,
    chips: ["Who should I ask about this?", "What's the current status?", "Show me the design doc"] },
  { match: /checkout|flash-sale|timeout/i,
    chips: ["Who owns checkout?", "Was this shipped?", "What did we decide about the budget?"] },
  { match: /ledger/i,
    chips: ["Who fixed the ledger webhook?", "What's PAY-501?", "Any open ledger decisions?"] },
  { match: /onboard|buddy|start/i,
    chips: ["How does this team review PRs?", "What are the standup times?", "Explain my assigned issue, PAY-482"] },
  { match: /vendor|pricing|contract/i,
    chips: ["Who can brief me on it?", "What did we decide about retries?"] },
];
function followupsFor(q: string): string[] {
  const hit = FOLLOWUPS.find((f) => f.match.test(q));
  return hit ? hit.chips : ["What did the team decide about retries?", "Who should I ask about the ledger?"];
}

function tagFor(q: string): string {
  const l = q.toLowerCase();
  const m = q.match(/pay-\d+/i);
  if (m) return m[0].toUpperCase() + " · issue";
  if (l.includes("vendor") || l.includes("pricing") || l.includes("contract")) return "Restricted";
  if (l.includes("checkout") || l.includes("flash-sale")) return "Checkout";
  if (l.includes("ledger")) return "Ledger";
  if (l.includes("onboard") || l.includes("buddy") || l.includes("start")) return "Onboarding";
  if (l.includes("who") || l.includes("ask")) return "People";
  if (l.includes("decide") || l.includes("decision") || l.includes("retr")) return "Decision";
  if (l.includes("reorg")) return "Org";
  if (l.includes("pull request") || l.includes(" pr ")) return "Process";
  return "Question";
}
const trunc = (s: string) => (s.length > 54 ? s.slice(0, 54) + "…" : s);

export default function App() {
  const [view, setView] = useState<"ask" | "memory">("ask");
  const [actingAs, setActingAs] = useState<ActingAs | null>(null);
  const [sources, setSources] = useState<Sources | null>(null);
  const [questions, setQuestions] = useState<Record<string, QItem>>({});
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");

  useEffect(() => { api.actingAs().then(setActingAs); api.sources().then(setSources).catch(() => {}); }, []);

  const onSwitch = async (name: string) => {
    const r = await api.setActingAs(name);
    setActingAs(r);
    setQuestions({}); setActive(null); setView("ask");
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || !actingAs) return;
    setView("ask");
    setActive(q);
    setQuestions((m) => ({ ...m, [q]: m[q] ?? { text: q, answer: null } }));
    setDraft("");
    if (questions[q]?.answer) return; // cached
    setLoading(true);
    try {
      const ans: Answer = await api.ask(actingAs.user_id, q);
      setQuestions((m) => ({ ...m, [q]: { text: q, answer: ans } }));
    } catch {
      setQuestions((m) => ({ ...m, [q]: { text: q, answer: null,
        error: "Shadow couldn't finish this question. Please try again." } }));
    } finally {
      setLoading(false);
    }
  };

  const items = useMemo(() => Object.values(questions), [questions]);
  const filtered = items.filter((q) => q.text.toLowerCase().includes(search.toLowerCase()));
  const current = active ? questions[active] : null;
  const title = view === "memory" ? "Team memory" : active ? trunc(active) : "New question";

  return (
    <main className="app">
      <Sidebar view={view} setView={setView} sources={sources} actingAs={actingAs} onSwitch={onSwitch} />

      <section className="panel questions" aria-label="Your questions">
        <div className="q-header">
          <h2>Your questions</h2>
          <button className="btn-primary" onClick={() => { setActive(null); setView("ask"); }}>
            <Icon d={ICONS.plus} sm />New
          </button>
        </div>
        <div className="q-search">
          <label htmlFor="q-search" className="visually-hidden">Search your questions</label>
          <input id="q-search" type="search" placeholder="Search your questions…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="q-list-wrap">
          <div className="q-group-label">Today</div>
          <ul className="q-list">
            {filtered.map((q) => (
              <li key={q.text}
                className={"q-item" + (active === q.text ? " active" : "")}
                onClick={() => { setActive(q.text); setView("ask"); if (!q.answer) ask(q.text); }}>
                <div className="q-tag">{tagFor(q.text)}</div>
                <div className="q-text">{q.text}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="q-footer"><Icon d={ICONS.lock} sm />Only you can see your questions</div>
      </section>

      <section className="panel main" aria-label="Main">
        <div className="topbar">
          <div className="topbar-title">{title}</div>
          <div className="topbar-pills">
            <span className="pill"><span className="dot green" />Shadowing Payments team</span>
            <span className="pill"><Icon d={ICONS.folder} sm />Answers from Box, with your access</span>
          </div>
        </div>

        {view === "memory" ? (
          <MemoryView />
        ) : (
          <div className="view view-ask">
            <div className="ask-scroll">
              {!active ? (
                <div className="empty-state">
                  <ShadowMark size={76} />
                  <h1 className="empty-headline">What are you stuck on?</h1>
                  <p className="empty-sub">I've been in the Payments team's meetings, channels, issues and docs. Ask anything; no question is too small.</p>
                  <div className="suggestions">
                    {SUGGESTIONS.map((s) => (
                      <button key={s.t} className="suggest-card" onClick={() => ask(s.t)}>
                        <span className="suggest-tile" style={{ background: s.bg, color: s.fg }}>
                          <Icon d={s.ic} />
                        </span>
                        <span className="suggest-text">{s.t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : loading && !current?.answer ? (
                <Thinking question={active} />
              ) : current?.error ? (
                <div className="answer-layout"><div className="conversation">
                  <div className="q-bubble">{active}</div>
                  <div role="alert">{current.error}</div>
                  <button className="btn-secondary" onClick={() => ask(active)}>Retry</button>
                </div></div>
              ) : current?.answer ? (
                <AnswerView question={active} answer={current.answer}
                  followups={followupsFor(active)} onAsk={ask} />
              ) : null}
            </div>

            <Composer draft={draft} setDraft={setDraft} onSend={ask} busy={loading} />
          </div>
        )}
      </section>
    </main>
  );
}

function Composer({ draft, setDraft, onSend, busy }: {
  draft: string; setDraft: (s: string) => void; onSend: (q: string) => void; busy: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); onSend(draft); }}>
      <div className="composer-box">
        <textarea ref={ref} rows={2} value={draft}
          placeholder="Ask about an issue, a decision, a doc, or who to talk to…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(draft); }
          }} />
        <div className="composer-row">
          <span className="pill small"><Icon d={ICONS.people} sm />Payments team</span>
          <span className="pill small"><Icon d={ICONS.lock} sm />Private</span>
          <button type="submit" className="send-btn" aria-label="Send question" disabled={!draft.trim() || busy}>
            <Icon d={ICONS.send} />
          </button>
        </div>
      </div>
      <p className="composer-caption">Every answer cites its sources in Box. If I don't know, I'll tell you who does.</p>
    </form>
  );
}
