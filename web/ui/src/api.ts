import type {
  ActingAs, Answer, Sources, ActivityRow, DecisionRow,
} from "./types";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
}
async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal,
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
}

export const api = {
  actingAs: () => get<ActingAs>("/api/acting-as"),
  setActingAs: (user: string) => post<ActingAs>("/api/acting-as", { user }),
  sources: () => get<Sources>("/api/sources"),
  ask: (user_id: string, question: string) =>
    post<Answer>("/api/ask", { user_id, question }, AbortSignal.timeout(120_000)),
  ingest: () => post<{ ok: boolean; steps?: unknown; error?: string }>("/api/ingest", {}),
  confirmTask: () =>
    post<{ ok: boolean; closed?: number; error?: string }>("/api/simulate/confirm-task", {}),
  activity: () => get<{ rows: ActivityRow[] }>("/api/activity"),
  decisions: () => get<{ rows: DecisionRow[] }>("/api/decisions"),
  embed: (fileId: string) =>
    get<{ url: string | null }>("/api/embed?file_id=" + encodeURIComponent(fileId)),
};
