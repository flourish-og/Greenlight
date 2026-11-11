import { useEffect, useMemo, useState } from "react"

type Tab = "live" | "replay"

interface LiveEvent {
  ts: string
  event: string
  [key: string]: unknown
}

interface LiveResponse {
  events: LiveEvent[]
  state: { status: string; loopID?: string; outcome?: string }
  total: number
}

interface ReceiptSummary {
  json: string
  loopID: string
  sessionID?: string
  outcome: string
  credits: number
  durationS: number
  attempts: number
  objective: string
  at: string
}

interface StepTotals {
  total: number
  passed: number
  failed: number
  skipped: number
  replayed: number
  authored: number
}

interface Member {
  name: string
  path?: string
  status: string
  authored?: boolean
  durationS?: number
  failedStep?: number
  failure?: { message: string; stepIndex?: number }
  screenshot?: string
  finalUrl?: string
  observed?: Record<string, string>
}

interface Verdict {
  family?: string
  category?: string
  severity?: string
  bugTitle?: string
  oneLiner?: string
  rootCause?: string
  suggestion?: string
  confidence?: number
  culpritStep?: string
}

interface Attempt {
  n: number
  kind: string
  command: string[]
  exitCode: number
  status: string
  durationS: number
  credits: number
  steps?: StepTotals
  members: Member[]
  verdict?: Verdict
  evidence: string[]
  summary: string
  startedAt: string
  endedAt: string
  stream?: string
}

interface Receipt {
  v: number
  loopID: string
  sessionID: string
  objective: string
  trigger: { kind: string; files: string[]; reason?: string }
  startedAt: string
  endedAt?: string
  outcome: string
  attempts: Attempt[]
  totals: { credits: number; durationS: number; authored: number; replayed: number; passed: number; failed: number }
  integrity: { ok: boolean; checked: number; changed: string[] }
  target: { url: string; reachable: boolean; startedByPlugin: boolean }
  notes?: string[]
}

interface ReplayEntry {
  at: string
  run: "red" | "green"
  type: "start" | "plan" | "member" | "authored" | "step" | "verdict" | "evidence" | "summary" | "receipt"
  title: string
  detail?: string
  data?: Record<string, unknown>
}

interface Replay {
  v: number
  kind: string
  label: string
  recordedAt: string
  provenance: string[]
  entries: ReplayEntry[]
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function formatTime(iso?: string): string {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function outcomeTone(outcome: string): string {
  if (outcome === "green") return "tone-green"
  if (outcome === "red") return "tone-red"
  if (outcome === "integrity_blocked") return "tone-amber"
  return "tone-grey"
}

function describeLive(event: LiveEvent): string {
  const record = event as Record<string, unknown>
  switch (event.event) {
    case "plugin.loaded":
      return `auto=${record.auto} match=${record.match}`
    case "verify.start": {
      const trigger = asRecord(record.trigger)
      const input = asRecord(record.input)
      return `${asString(trigger?.kind) ?? "tool"}${asString(input?.reason ?? trigger?.reason) ? ` - ${asString(input?.reason ?? trigger?.reason)}` : ""}`
    }
    case "kane.start": {
      const args = Array.isArray(record.args) ? record.args.map(String) : []
      return args.join(" ")
    }
    case "kane.event":
      return asString(record.type) ?? ""
    case "kane.end": {
      const steps = asRecord(record.steps)
      return `${asString(record.status)} - ${asString(steps ? `${steps.passed}/${steps.total} steps` : "")} - ${record.credits} credits`
    }
    case "loop.red": {
      const failed = Array.isArray(record.failed) ? record.failed.map(String) : []
      return `attempt ${record.attempt} - failed: ${failed.join(", ") || "see receipt"}`
    }
    case "loop.finished":
      return `${asString(record.outcome)} - ${record.credits} credits - ${record.attempts} attempt(s)`
    case "app.edit":
      return asString(record.path) ?? ""
    case "turn.ended":
      return `run=${record.run} - ${asString(record.reason) ?? ""}`
    case "devserver.start":
      return asString(record.command) ?? ""
    default:
      return ""
  }
}

function VerdictCard({ verdict }: { verdict: Verdict }) {
  const kind = [verdict.family, verdict.category, verdict.severity].filter(Boolean).join(" / ")
  return (
    <div className="verdict" data-testid="verdict">
      <div className="verdict-head">
        <span className="verdict-label">Kane verdict</span>
        <span className="verdict-kind">{kind || "failure"}</span>
        {verdict.confidence !== undefined && <span className="verdict-confidence">confidence {verdict.confidence}</span>}
      </div>
      <h4>{verdict.bugTitle ?? "Failure"}</h4>
      {verdict.oneLiner && <p className="verdict-line">{verdict.oneLiner}</p>}
      {verdict.rootCause && (
        <p>
          <span className="field">Root cause</span> {verdict.rootCause}
        </p>
      )}
      {verdict.suggestion && (
        <p>
          <span className="field">Fix</span> {verdict.suggestion}
        </p>
      )}
      {verdict.culpritStep && (
        <p>
          <span className="field">Culprit</span> {verdict.culpritStep}
        </p>
      )}
    </div>
  )
}

function AttemptCard({ attempt }: { attempt: Attempt }) {
  return (
    <article className="attempt">
      <header>
        <span className={`pill ${attempt.status === "passed" ? "tone-green" : "tone-red"}`}>{attempt.status}</span>
        <span className="attempt-n">attempt {attempt.n}</span>
        <span className="muted">
          exit {attempt.exitCode} - {attempt.durationS}s - {attempt.credits} credits
        </span>
      </header>
      {attempt.steps && (
        <div className="stepbar">
          <span>
            <strong>{attempt.steps.passed}</strong> passed
          </span>
          <span>
            <strong>{attempt.steps.failed}</strong> failed
          </span>
          <span>
            <strong>{attempt.steps.authored}</strong> authored
          </span>
          <span>
            <strong>{attempt.steps.replayed}</strong> replayed
          </span>
          <span className="muted">of {attempt.steps.total} steps</span>
        </div>
      )}
      <ul className="members">
        {attempt.members.map((member) => (
          <li key={member.name} className={member.status === "passed" ? "ok" : "bad"}>
            <span className="dot" />
            <span className="member-name">{member.name}</span>
            {member.authored && <span className="tag">authored</span>}
            <span className="member-status">{member.status}</span>
            {member.failure && (
              <span className="member-failure">
                step {member.failedStep ?? member.failure.stepIndex ?? "?"}: {member.failure.message}
              </span>
            )}
          </li>
        ))}
      </ul>
      {attempt.verdict && <VerdictCard verdict={attempt.verdict} />}
      {(attempt.stream || attempt.evidence.length > 0) && (
        <footer className="paths">
          {attempt.stream && <span>raw: {attempt.stream}</span>}
          {attempt.evidence.slice(0, 2).map((path) => (
            <span key={path}>evidence: {path}</span>
          ))}
        </footer>
      )}
    </article>
  )
}

function ReceiptDetail({ receipt }: { receipt: Receipt }) {
  return (
    <section className="receipt-detail" data-testid="receipt-detail">
      <header className="receipt-head">
        <span className={`pill ${outcomeTone(receipt.outcome)}`}>{receipt.outcome.toUpperCase()}</span>
        <h3>{receipt.objective || "(no objective)"}</h3>
      </header>
      <p className="muted">
        loop {receipt.loopID} - {receipt.trigger.kind} - {formatTime(receipt.startedAt)}
        {receipt.endedAt ? ` to ${formatTime(receipt.endedAt)}` : ""} - {receipt.target.url}
      </p>
      <div className="totals">
        <span>
          <strong>{receipt.totals.passed}</strong> passed
        </span>
        <span>
          <strong>{receipt.totals.failed}</strong> failed
        </span>
        <span>
          <strong>{receipt.totals.authored}</strong> authored
        </span>
        <span>
          <strong>{receipt.totals.replayed}</strong> replayed
        </span>
        <span>
          <strong>{receipt.totals.credits}</strong> credits
        </span>
        <span>
          <strong>{receipt.totals.durationS}</strong> s
        </span>
      </div>
      {!receipt.integrity.ok && (
        <p className="blocked">Integrity blocked: {receipt.integrity.changed.join(", ")}</p>
      )}
      {receipt.attempts.map((attempt) => (
        <AttemptCard key={attempt.n} attempt={attempt} />
      ))}
      {receipt.notes?.length ? (
        <ul className="notes">
          {receipt.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function LiveView() {
  const [live, setLive] = useState<LiveResponse | undefined>()
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([])
  const [selected, setSelected] = useState<string | undefined>()
  const [receipt, setReceipt] = useState<Receipt | undefined>()
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    let alive = true
    async function tick() {
      try {
        const [liveResponse, receiptsResponse] = await Promise.all([
          fetch("/api/live").then((response) => response.json() as Promise<LiveResponse>),
          fetch("/api/receipts").then((response) => response.json() as Promise<{ receipts: ReceiptSummary[] }>),
        ])
        if (!alive) return
        setLive(liveResponse)
        setReceipts(receiptsResponse.receipts ?? [])
        setError(undefined)
      } catch (cause) {
        if (alive) setError(String(cause))
      }
    }
    void tick()
    const timer = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    let alive = true
    fetch(`/api/receipts/${encodeURIComponent(selected)}`)
      .then((response) => response.json() as Promise<{ receipt?: Receipt; error?: string }>)
      .then((body) => {
        if (alive) setReceipt(body.receipt)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [selected])

  const status = live?.state.status ?? "idle"
  const events = useMemo(() => (live ? [...live.events].reverse() : []), [live])

  return (
    <div className="live">
      <div className="statusbar">
        <span className={`status ${outcomeTone(status === "blocked" ? "integrity_blocked" : status)}`} data-testid="loop-status">
          {status}
        </span>
        <span className="muted">
          {live?.state.loopID ? `loop ${live.state.loopID}` : "no loop yet"} - {live?.total ?? 0} events
        </span>
        {error && <span className="error">{error}</span>}
      </div>
      <div className="columns">
        <aside className="receipts">
          <h2>Loop receipts</h2>
          {receipts.length === 0 && <p className="muted">No receipts yet. Run greenlight_verify.</p>}
          <ul>
            {receipts.map((entry) => (
              <li key={entry.json}>
                <button
                  type="button"
                  className={selected === entry.json ? "receipt-button selected" : "receipt-button"}
                  onClick={() => setSelected(entry.json)}
                >
                  <span className={`pill ${outcomeTone(entry.outcome)}`}>{entry.outcome.toUpperCase()}</span>
                  <span className="receipt-objective">{entry.objective || entry.loopID}</span>
                  <span className="muted">
                    {formatTime(entry.at)} - {entry.attempts} attempt(s) - {entry.credits} cr
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="detail">
          {receipt ? (
            <ReceiptDetail receipt={receipt} />
          ) : (
            <p className="muted">Select a receipt to see its attempts, verdict and evidence.</p>
          )}
        </main>
        <aside className="feed">
          <h2>Live tail</h2>
          <ol>
            {events.map((event, index) => (
              <li key={`${event.ts}-${index}`}>
                <span className="feed-time">{formatTime(event.ts)}</span>
                <span className={`feed-type type-${event.event.split(".")[0]}`}>{event.event}</span>
                <span className="feed-detail">{describeLive(event)}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}

function ReplayView() {
  const [replay, setReplay] = useState<Replay | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    fetch("/api/replay")
      .then((response) => response.json() as Promise<{ replay?: Replay; error?: string }>)
      .then((body) => {
        if (body.replay) setReplay(body.replay)
        else setError(body.error ?? "no replay")
      })
      .catch((cause) => setError(String(cause)))
  }, [])

  useEffect(() => {
    if (!playing || !replay) return
    const timer = setInterval(() => {
      setIndex((current) => {
        if (current >= replay.entries.length) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 550)
    return () => clearInterval(timer)
  }, [playing, replay])

  if (error) return <p className="error">{error}</p>
  if (!replay) return <p className="muted">Loading recorded loop...</p>

  const visible = replay.entries.slice(0, index)
  const done = index >= replay.entries.length
  const current = replay.entries[Math.max(0, index - 1)]

  const restart = () => {
    setIndex(0)
    setPlaying(true)
  }

  return (
    <div className="replay">
      <div className="replay-banner">
        <span className="pill tone-recorded">RECORDED</span>
        <div>
          <strong>{replay.label}</strong>
          <p className="muted">
            Real Kane runs replayed from committed evidence - no browser, no credits. Recorded {replay.recordedAt}.
          </p>
        </div>
      </div>
      <div className="controls">
        <button type="button" className="primary" onClick={() => setPlaying((value) => !value)} disabled={done && !playing}>
          {playing ? "Pause" : done ? "Done" : "Play"}
        </button>
        <button type="button" className="secondary" onClick={restart}>
          Restart
        </button>
        <div className="progress" aria-label="replay progress">
          <div className="progress-fill" style={{ width: `${(index / replay.entries.length) * 100}%` }} />
        </div>
        <span className="muted" data-testid="replay-progress">
          {index}/{replay.entries.length}
        </span>
      </div>
      <div className="replay-grid">
        <ol className="timeline">
          {visible.map((entry, position) => (
            <li key={`${entry.at}-${position}`} className={`entry run-${entry.run} type-${entry.type}`}>
              <span className="entry-run">{entry.run === "red" ? "RED" : "GREEN"}</span>
              <div className="entry-body">
                <div className="entry-head">
                  <span className="entry-title">{entry.title}</span>
                  <span className="feed-time">{formatTime(entry.at)}</span>
                </div>
                {entry.detail && <p className="muted">{entry.detail}</p>}
                {entry.type === "verdict" && asRecord(entry.data?.verdict) && (
                  <VerdictCard verdict={entry.data?.verdict as Verdict} />
                )}
              </div>
            </li>
          ))}
        </ol>
        <aside className="replay-side">
          {current && (
            <>
              <h2>Now</h2>
              <p className={`pill ${current.run === "red" ? "tone-red" : "tone-green"}`}>{current.run.toUpperCase()}</p>
              <h3>{current.title}</h3>
              {current.detail && <p className="muted">{current.detail}</p>}
              {current.type === "verdict" && asRecord(current.data?.verdict) && (
                <VerdictCard verdict={current.data?.verdict as Verdict} />
              )}
            </>
          )}
          <h2>Provenance</h2>
          <ul className="provenance">
            {replay.provenance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>("live")
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Loop Board</h1>
            <p className="muted">Red to green, on the record.</p>
          </div>
        </div>
        <nav>
          <button type="button" className={tab === "live" ? "tab selected" : "tab"} onClick={() => setTab("live")}>
            Live
          </button>
          <button type="button" className={tab === "replay" ? "tab selected" : "tab"} onClick={() => setTab("replay")}>
            Replay
          </button>
        </nav>
      </header>
      {tab === "live" ? <LiveView /> : <ReplayView />}
    </div>
  )
}
