/**
 * Loop Receipts: the durable, honest record of one red->green attempt.
 *
 * A receipt is written for every verification pass, including the ones that
 * never reached Kane (integrity blocked, budget exhausted, target down), so the
 * board never has to guess why a loop stopped.
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { KaneResult } from "./kane.ts"

export type LoopOutcome =
  | "green"
  | "red"
  | "budget_exhausted"
  | "max_iterations"
  | "stalled"
  | "integrity_blocked"
  | "target_unreachable"
  | "not_started"
  | "cancelled"

export interface ReceiptAttempt {
  n: number
  kind: "suite" | "objective"
  command: string[]
  exitCode: number
  status: KaneResult["status"]
  durationS: number
  credits: number
  steps?: KaneResult["steps"]
  members: KaneResult["members"]
  verdict?: KaneResult["verdict"]
  evidence: string[]
  summary: string
  startedAt: string
  endedAt: string
  /** Repo-relative path to the raw NDJSON this verdict was parsed from. */
  stream?: string
}

export interface LoopReceipt {
  v: 1
  loopID: string
  sessionID: string
  objective: string
  trigger: { kind: "tool" | "auto" | "manual"; files: string[]; reason?: string }
  startedAt: string
  endedAt?: string
  outcome: LoopOutcome
  attempts: ReceiptAttempt[]
  totals: {
    credits: number
    durationS: number
    authored: number
    replayed: number
    passed: number
    failed: number
  }
  integrity: {
    ok: boolean
    checked: number
    changed: string[]
  }
  target: {
    url: string
    reachable: boolean
    startedByPlugin: boolean
  }
  notes?: string[]
}

export function newReceipt(input: {
  loopID: string
  sessionID: string
  objective: string
  trigger: LoopReceipt["trigger"]
  target: LoopReceipt["target"]
  integrity: LoopReceipt["integrity"]
}): LoopReceipt {
  return {
    v: 1,
    loopID: input.loopID,
    sessionID: input.sessionID,
    objective: input.objective,
    trigger: input.trigger,
    startedAt: new Date().toISOString(),
    outcome: "red",
    attempts: [],
    totals: { credits: 0, durationS: 0, authored: 0, replayed: 0, passed: 0, failed: 0 },
    integrity: input.integrity,
    target: input.target,
    notes: [],
  }
}

export function attemptFromResult(n: number, kind: "suite" | "objective", result: KaneResult, startedAt: string): ReceiptAttempt {
  return {
    n,
    kind,
    command: result.command,
    exitCode: result.exitCode,
    status: result.status,
    durationS: result.durationS,
    credits: result.credits,
    steps: result.steps,
    members: result.members,
    verdict: result.verdict,
    evidence: result.evidence,
    summary: result.summary,
    startedAt,
    endedAt: new Date().toISOString(),
  }
}

export function addAttempt(receipt: LoopReceipt, attempt: ReceiptAttempt): void {
  receipt.attempts.push(attempt)
  receipt.totals.credits = Math.round((receipt.totals.credits + attempt.credits) * 100) / 100
  receipt.totals.durationS = Math.round((receipt.totals.durationS + attempt.durationS) * 10) / 10
  if (attempt.steps) {
    receipt.totals.authored += attempt.steps.authored
    receipt.totals.replayed += attempt.steps.replayed
    receipt.totals.passed += attempt.steps.passed
    receipt.totals.failed += attempt.steps.failed
  }
}

export interface WrittenReceipt {
  jsonPath: string
  markdownPath: string
}

function shortID(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9]/g, "").slice(-8) || "loop"
}

export function renderReceiptMarkdown(receipt: LoopReceipt): string {
  const lines: string[] = []
  const icon = receipt.outcome === "green" ? "GREEN" : receipt.outcome === "red" ? "RED" : receipt.outcome.toUpperCase()
  lines.push(`# Loop Receipt - ${icon}`)
  lines.push("")
  lines.push(`- loop: \`${receipt.loopID}\``)
  lines.push(`- session: \`${receipt.sessionID}\``)
  lines.push(`- objective: ${receipt.objective || "(none)"}`)
  lines.push(`- trigger: ${receipt.trigger.kind}${receipt.trigger.reason ? ` - ${receipt.trigger.reason}` : ""}`)
  lines.push(`- target: ${receipt.target.url} (${receipt.target.reachable ? "reachable" : "unreachable"})`)
  lines.push(`- started: ${receipt.startedAt}`)
  if (receipt.endedAt) lines.push(`- ended: ${receipt.endedAt}`)
  lines.push("")
  lines.push("| # | exit | status | tests | authored | replayed | seconds | credits |")
  lines.push("|---|---|---|---|---|---|---|---|")
  for (const attempt of receipt.attempts) {
    const tests = attempt.steps ? `${attempt.steps.passed}/${attempt.steps.total}` : "-"
    lines.push(
      `| ${attempt.n} | ${attempt.exitCode} | ${attempt.status} | ${tests} | ${attempt.steps?.authored ?? "-"} | ${attempt.steps?.replayed ?? "-"} | ${attempt.durationS} | ${attempt.credits} |`,
    )
  }
  lines.push("")
  lines.push(
    `Totals: **${receipt.totals.credits} credits**, ${receipt.totals.durationS}s, ${receipt.totals.passed} passed, ${receipt.totals.failed} failed.`,
  )
  const streams = receipt.attempts.filter((attempt) => attempt.stream)
  if (streams.length > 0) {
    lines.push("")
    for (const attempt of streams) lines.push(`Raw NDJSON (attempt ${attempt.n}): \`${attempt.stream}\``)
  }
  if (!receipt.integrity.ok) {
    lines.push("")
    lines.push(`Integrity: BLOCKED - protected files changed: ${receipt.integrity.changed.join(", ")}`)
  }
  if (receipt.notes?.length) {
    lines.push("")
    for (const note of receipt.notes) lines.push(`- ${note}`)
  }
  return lines.join("\n") + "\n"
}

export async function writeReceipt(root: string, receiptsDir: string, receipt: LoopReceipt): Promise<WrittenReceipt> {
  const dir = join(root, receiptsDir)
  await mkdir(dir, { recursive: true })
  const stamp = receipt.startedAt.replaceAll(":", "-").replace(/\.\d+Z$/, "Z")
  const base = `${stamp}-${shortID(receipt.loopID)}`
  const jsonPath = join(dir, `${base}.json`)
  const markdownPath = join(dir, `${base}.md`)
  await writeFile(jsonPath, JSON.stringify(receipt, null, 2) + "\n", "utf8")
  await writeFile(markdownPath, renderReceiptMarkdown(receipt), "utf8")
  await appendFile(
    join(dir, "index.ndjson"),
    JSON.stringify({
      loopID: receipt.loopID,
      sessionID: receipt.sessionID,
      outcome: receipt.outcome,
      credits: receipt.totals.credits,
      durationS: receipt.totals.durationS,
      attempts: receipt.attempts.length,
      objective: receipt.objective,
      at: receipt.startedAt,
      json: `${base}.json`,
    }) + "\n",
    "utf8",
  )
  return { jsonPath, markdownPath }
}

/**
 * Persist the raw NDJSON of one Kane run next to (but outside) the receipts, so
 * any receipt can be re-parsed later without spending credits. Returns the
 * repo-relative path that goes into the receipt.
 */
export async function writeRunLog(
  root: string,
  receiptsDir: string,
  loopID: string,
  attempt: number,
  lines: readonly string[],
): Promise<string> {
  const dir = join(root, dirname(receiptsDir), "runs")
  await mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")
  const name = `${stamp}-${shortID(loopID)}-a${attempt}.ndjson`
  const full = join(dir, name)
  await writeFile(full, lines.join("\n") + "\n", "utf8")
  const rootNorm = root.replaceAll("\\", "/").replace(/\/+$/, "")
  const normalized = full.replaceAll("\\", "/")
  return normalized.startsWith(`${rootNorm}/`) ? normalized.slice(rootNorm.length + 1) : normalized
}

/** Append-only stream the Loop Board tails. Never throws. */
export async function appendLive(root: string, event: Record<string, unknown>): Promise<void> {
  try {
    const dir = join(root, ".greenlight")
    await mkdir(dir, { recursive: true })
    await appendFile(join(dir, "live.ndjson"), JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n", "utf8")
  } catch {
    /* the loop must not die because a log line failed */
  }
}
