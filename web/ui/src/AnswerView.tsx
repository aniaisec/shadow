import { useEffect, useRef, useState } from "react";
import type { Answer, Citation } from "./types";
import { api } from "./api";
import { Chip, Icon, ICONS, ShadowMark, initials, renderMarkdown, srcIcon } from "./ui";

const STEPS = ["Searching team memory", "Checking what you can access",
  "Reading sources", "Finding who to ask"];

export function Thinking({ question }: { question: string }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setDone((d) => Math.max(d, i + 1)), 300 + i * 450));
    return () => timers.forEach(clearTimeout);
  }, [question]);
  return (
    <div className="answer-layout"><div className="conversation">
      <div className="q-bubble">{question}</div>
      <div className="thinking">
        <div className="thinking-head"><ShadowMark size={24} />Shadow is thinking…</div>
        {STEPS.map((s, i) => (
          <div key={i} className={"tstep" + (i < done ? " done" : "")}>
            <span className="tick" />{s}
          </div>
        ))}
      </div>
    </div></div>
  );
}

export function AnswerView({ question, answer, followups = [], onAsk }:
  { question: string; answer: Answer; followups?: string[]; onAsk?: (q: string) => void }) {
  const cites = answer.citations ?? [];
  const refused = Boolean(answer.restricted_note) && cites.length === 0;
  const [sel, setSel] = useState(0);
  const selectCite = (n: number) => setSel(Math.max(0, Math.min(cites.length - 1, n - 1)));

  return (
    <div className="answer-layout">
      <div className="conversation">
        <div className="q-bubble">{question}</div>
        <div className="answer-block">
          <div className="answer-by"><ShadowMark size={24} /> Shadow</div>
          {!refused && <div className="answer-md">{renderMarkdown(answer.answer_markdown, selectCite)}</div>}
          {refused && (
            <div className="restricted" role="status">
              <Icon d={ICONS.lock} sm />
              <div>
                <div className="rtitle">I can't use that source for you</div>
                <div className="rbody">{answer.restricted_note}</div>
              </div>
            </div>
          )}

          {answer.decision_status && (
            <div className="decision-row">
              <span className="lbl">Decision</span>
              <span className="txt">{answer.decision_status.decision}</span>
              <Chip ds={answer.decision_status} />
            </div>
          )}

          {cites.length > 0 && (
            <div className="sources">
              <h4>Where this was discussed</h4>
              {cites.map((c, i) => (
                <div key={c.file_id} className="source-row" onClick={() => setSel(i)}>
                  <span className="num">{i + 1}</span>
                  <Icon d={srcIcon(c.source_type)} sm />
                  <a className="nm" href={c.box_url} target="_blank" rel="noopener">{c.name}</a>
                  <span className="meta">{c.source_type} · {c.date}</span>
                </div>
              ))}
            </div>
          )}

          {answer.who_to_ask && (
            <div className="who-card">
              <span className="wavatar">{initials(answer.who_to_ask.name)}</span>
              <div>
                <div className="wname">{answer.who_to_ask.name}</div>
                <div className="wrole">{answer.who_to_ask.role}</div>
                <div className="wreason">{answer.who_to_ask.reason}</div>
                {answer.who_to_ask.moved_note && (
                  <div className="wmoved">{answer.who_to_ask.moved_note}</div>
                )}
              </div>
            </div>
          )}

          {answer.restricted_note && !refused && (
            <div className="restricted">
              <Icon d={ICONS.lock} sm />
              <div>
                <div className="rtitle">One source was withheld</div>
                <div className="rbody">{answer.restricted_note}</div>
              </div>
            </div>
          )}

          {!refused && followups.length > 0 && onAsk && (
            <div className="followups">
              <span className="followups-label">Ask a follow-up</span>
              <div className="followup-chips">
                {followups.map((f) => (
                  <button key={f} className="followup-chip" onClick={() => onAsk(f)}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {cites.length > 0 && <Preview cite={cites[sel]} />}
    </div>
  );
}

function Preview({ cite }: { cite: Citation }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const reqId = useRef(0);
  useEffect(() => {
    const id = ++reqId.current;
    setUrl(undefined);
    api.embed(cite.file_id)
      .then((r) => { if (id === reqId.current) setUrl(r.url); })
      .catch(() => { if (id === reqId.current) setUrl(null); });
  }, [cite.file_id]);

  return (
    <div className="preview">
      <div className="preview-card">
        <div className="preview-head">
          <Icon d={srcIcon(cite.source_type)} sm />
          <span className="pnm">{cite.name}</span>
          <span className="pdate">{cite.date}</span>
          <a className="open-box" href={cite.box_url} target="_blank" rel="noopener">
            Open in Box <Icon d={ICONS.ext} sm />
          </a>
        </div>
        {url === undefined && <div className="ph">Loading preview…</div>}
        {url === null && <div className="ph">Preview unavailable — open in Box.</div>}
        {url && <iframe src={url} title={cite.name} />}
      </div>
    </div>
  );
}
