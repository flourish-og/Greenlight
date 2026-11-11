/**
 * Kane CLI adapter: resolve the binary, stream NDJSON, parse it into a verdict.
 *
 * All parsing is done from the real stream shapes measured in Phase 0/1 and
 * recorded in docs/KANE_NOTES.md. Nothing here invents fields: every accessor
 * reads a key that was observed in a real run.
 */
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export interface KaneFailure {
  message: string
  stepIndex?: number
}

export interface KaneMember {
  path: string
  name: string
  status: string
  durationS?: number
  sessionID?: string
  failure?: KaneFailure
  /** True when this flow was authored (recorded) during the run, not replayed. */
  authored?: boolean
  /** Per-flow session stream, present on `testrun run`; enriched after the run. */
  logPath?: string
  /** Step that failed inside the flow (from the member's own stream). */
  failedStep?: number
  /** Screenshot of the failing step, straight from Kane. */
  screenshot?: string
  /** Last URL the browser was on for this flow. */
  finalUrl?: string
  /** Values the flow stored (`variables_out`), i.e. what Kane actually saw. */
  observed?: Record<string, string>
}

export interface StepTotals {
  total: number
  passed: number
  failed: number
  skipped: number
  replayed: number
  authored: number
}

export interface MemberLogDetail {
  steps?: StepTotals
  failedStep?: number
  failureReason?: string
  screenshot?: string
  finalUrl?: string
  observed?: Record<string, string>
  /** Sum of `run_end.credits_consumed` (plus the verdict call) in this flow. */
  credits?: number
  verdict?: KaneVerdict
}

export interface KaneVerdict {
  family?: string
  category?: string
  severity?: string
  bugTitle?: string
  rootCause?: string
  oneLiner?: string
  suggestion?: string
  confidence?: number
  culpritStep?: string
}

export type KaneStatus = "passed" | "failed" | "not_started" | "timeout"

export interface KaneResult {
  command: string[]
  exitCode: number
  started: boolean
  status: KaneStatus
  durationS: number
  credits: number
  /** Where `credits` came from: the run stream itself, or the per-flow logs. */
  creditsSource?: "run_stream" | "member_logs"
  summary: string
  members: KaneMember[]
  steps?: { total: number; passed: number; failed: number; skipped: number; replayed: number; authored: number }
  verdict?: KaneVerdict
  /** One or more evidence packs, newest last. */
  evidence: string[]
  sessionDirs: string[]
  failureBrief: string
}

interface ParseOptions {
  command: string[]
  exitCode: number
  durationS: number
  /** Set when the child process had to be killed. */
  timedOut?: boolean
}

/** Windows installs the entry as `bin/kane-cli.cjs`; POSIX uses `bin/kane-cli`. */
export function resolveKaneCommand(root: string): string[] {
  const explicit = process.env.KANE_CLI_BIN
  if (explicit) return [explicit]

  const nodeBin = process.versions.bun ? (process.env.KANE_CLI_NODE ?? "node") : process.execPath

  const candidates = [
    join(root, "node_modules", "@testmuai", "kane-cli", "bin", "kane-cli.cjs"),
    join(homedir(), "AppData", "Roaming", "npm", "node_modules", "@testmuai", "kane-cli", "bin", "kane-cli.cjs"),
    "/usr/local/lib/node_modules/@testmuai/kane-cli/bin/kane-cli.cjs",
    "/usr/lib/node_modules/@testmuai/kane-cli/bin/kane-cli.cjs",
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return [nodeBin, candidate]
  }

  // Last resort: let the shell find the shim.
  return [process.platform === "win32" ? "kane-cli.cmd" : "kane-cli"]
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined
}

export function parseKaneLines(lines: readonly string[], options: ParseOptions): KaneResult {
  let started = false
  let statusFromDone: KaneStatus | undefined
  let durationS = options.durationS
  let credits = 0
  let summary = ""
  const members: KaneMember[] = []
  /** Flow-level counts from `testrun_summary.totals` (fallback only). */
  let flowTotals: StepTotals | undefined
  /** Step-level counts, from a single `test_md_summary` or summed member logs. */
  let steps: StepTotals | undefined
  let verdict: KaneVerdict | undefined
  const evidence: string[] = []
  const sessionDirs: string[] = []
  let sawFailure = false
  let resultCode: number | undefined
  let reasonCode: string | undefined

  for (const line of lines) {
    let trimmed = line.trim()
    if (trimmed.charCodeAt(0) === 0xfeff) trimmed = trimmed.slice(1)
    if (!trimmed.startsWith("{")) continue
    let event: Record<string, unknown>
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      continue
    }

    const type = asString(event.type)
    if (type === "stream_start" || type === "run_start" || type === "testrun_start") started = true

    if (type === "run_end") {
      const status = asString(event.status)
      if (status === "failed") sawFailure = true
      const runDuration = asNumber(event.duration)
      if (runDuration !== undefined) durationS = Math.max(durationS, runDuration)
      const runCredits = asNumber(event.credits_consumed)
      if (runCredits !== undefined) credits += runCredits
      const runSummary = asString(event.summary)
      if (runSummary) summary = runSummary
      const sessionDir = asString(event.session_dir)
      if (sessionDir) sessionDirs.push(sessionDir)
      const sessionEvidence = asString(event.evidence_path)
      if (sessionEvidence) evidence.push(sessionEvidence)
      const rawVerdict = asRecord(event.verdict)
      if (rawVerdict) {
        verdict = {
          family: asString(rawVerdict.family),
          category: asString(rawVerdict.category),
          severity: asString(rawVerdict.severity),
          bugTitle: asString(rawVerdict.bug_title),
          rootCause: asString(rawVerdict.root_cause),
          oneLiner: asString(rawVerdict.one_liner),
          suggestion: asString(rawVerdict.suggestion),
          confidence: asNumber(rawVerdict.confidence),
          culpritStep: asString(rawVerdict.culprit_step),
        }
      }
      if (typeof event.result_code === "number") resultCode = event.result_code
      if (typeof event.reason_code === "string") reasonCode = event.reason_code
    }

    if (type === "testrun_member_end" || type === "testrun_authored_member_end") {
      const failure = asRecord(event.failure)
      const path = asString(event.path) ?? ""
      members.push({
        path,
        name: path.split(/[\\/]/).pop() ?? path,
        status: asString(event.status) ?? "unknown",
        durationS: asNumber(event.duration_s),
        sessionID: asString(event.session_id),
        logPath: asString(event.log_path),
        authored: type === "testrun_authored_member_end",
        failure: failure
          ? { message: asString(failure.message) ?? "unknown failure", stepIndex: asNumber(failure.step_index) }
          : undefined,
      })
    }

    if (type === "coverage") {
      const pack = asString(event.pack)
      if (pack) evidence.push(pack)
    }

    if (type === "testrun_summary") {
      const execution = asRecord(event.execution)
      const executionStatus = asString(execution?.status)
      if (executionStatus === "failed") sawFailure = true
      if (executionStatus === "passed") statusFromDone = "passed"
      const evidenceID = asString(execution?.evidence_id)
      if (evidenceID) evidence.push(join(process.cwd(), ".testmuai", "evidence", `${evidenceID}.evidence`))
      const totals = asRecord(event.totals)
      if (totals) {
        flowTotals = {
          total: asNumber(totals.tests) ?? 0,
          passed: asNumber(totals.passed) ?? 0,
          failed: asNumber(totals.failed) ?? 0,
          skipped: asNumber(totals.skipped) ?? 0,
          authored: asNumber(totals.authored) ?? 0,
          replayed: 0,
        }
      }
      const summaryDuration = asNumber(event.duration_s)
      if (summaryDuration !== undefined) durationS = Math.max(durationS, summaryDuration)
    }

    if (type === "test_md_summary") {
      const rawSteps = asRecord(event.steps)
      if (rawSteps) {
        steps = {
          total: asNumber(rawSteps.total) ?? 0,
          passed: asNumber(rawSteps.passed) ?? 0,
          failed: asNumber(rawSteps.failed) ?? 0,
          skipped: asNumber(rawSteps.skipped) ?? 0,
          authored: asNumber(rawSteps.author_decisions) ?? 0,
          replayed: asNumber(rawSteps.replay_decisions) ?? 0,
        }
      }
    }

    if (type === "testrun_done") {
      const overall = asString(event.overall_status)
      if (overall === "passed") statusFromDone = "passed"
      if (overall === "failed" || overall === "broken") {
        statusFromDone = "failed"
        sawFailure = true
      }
    }

    if (type === "error") sawFailure = true
  }

  let status: KaneStatus
  if (options.timedOut) status = "timeout"
  else if (!started) status = "not_started"
  else if (options.exitCode !== 0 || sawFailure) status = "failed"
  else status = statusFromDone ?? "passed"

  return {
    command: options.command,
    exitCode: options.exitCode,
    started,
    status,
    durationS: Math.round(durationS * 10) / 10,
    credits: Math.round(credits * 100) / 100,
    summary: summary || reasonCode || (status === "passed" ? "All checks passed." : ""),
    members,
    steps: steps ?? flowTotals,
    verdict,
    evidence,
    sessionDirs,
    failureBrief: "",
  }
}

const MAX_BRIEF_LINES = 40

/** Best-effort read of one member's own session stream. Never throws. */
export function parseMemberLog(lines: readonly string[]): MemberLogDetail {
  const detail: MemberLogDetail = {}
  for (const line of lines) {
    let trimmed = line.trim()
    if (trimmed.charCodeAt(0) === 0xfeff) trimmed = trimmed.slice(1)
    if (!trimmed.startsWith("{")) continue
    let event: Record<string, unknown>
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      continue
    }

    if (event.type === "test_md_summary") {
      const rawSteps = asRecord(event.steps)
      if (rawSteps) {
        detail.steps = {
          total: asNumber(rawSteps.total) ?? 0,
          passed: asNumber(rawSteps.passed) ?? 0,
          failed: asNumber(rawSteps.failed) ?? 0,
          skipped: asNumber(rawSteps.skipped) ?? 0,
          authored: asNumber(rawSteps.author_decisions) ?? 0,
          replayed: asNumber(rawSteps.replay_decisions) ?? 0,
        }
      }
    }

    if (event.type === "test_md_step_end") {
      if (asString(event.status) === "failed" && detail.failedStep === undefined) {
        detail.failedStep = asNumber(event.step_index)
      }
    }

    if (event.type === "run_end") {
      const runCredits = asNumber(event.credits_consumed)
      if (runCredits !== undefined) detail.credits = (detail.credits ?? 0) + runCredits
      const finalUrl = asString(event.final_url)
      if (finalUrl) detail.finalUrl = finalUrl
      const rawVariables = asRecord(event.variables_out)
      if (rawVariables) {
        const observed: Record<string, string> = {}
        for (const [key, value] of Object.entries(rawVariables)) {
          const variable = asRecord(value)
          if (!variable) continue
          if (variable.secret === true) continue
          const text = asString(variable.value ?? variable.text)
          if (text) observed[key] = text
        }
        if (Object.keys(observed).length > 0) detail.observed = observed
      }
      const rawVerdict = asRecord(event.verdict)
      if (rawVerdict) {
        detail.verdict = {
          family: asString(rawVerdict.family),
          category: asString(rawVerdict.category),
          severity: asString(rawVerdict.severity),
          bugTitle: asString(rawVerdict.bug_title),
          rootCause: asString(rawVerdict.root_cause),
          oneLiner: asString(rawVerdict.one_liner),
          suggestion: asString(rawVerdict.suggestion),
          confidence: asNumber(rawVerdict.confidence),
          culpritStep: asString(rawVerdict.culprit_step),
        }
        const verdictCredits = asNumber(rawVerdict.credits_consumed)
        if (verdictCredits !== undefined) detail.credits = (detail.credits ?? 0) + verdictCredits
      }
      if (asString(event.status) === "failed") {
        const reason = asString(event.reason) ?? asString(event.summary)
        if (reason) detail.failureReason = reason
        const screenshot = asString(event.screenshot_path)
        if (screenshot) detail.screenshot = screenshot
      }
    }
  }
  return detail
}

/**
 * Read each flow's own `log_path` and merge it into the verdict: step-level
 * pass/fail counts, the failing step, the screenshot, and the values the flow
 * actually saw. Falls back silently when a log is missing (e.g. a plain `run`).
 */
export function enrichResult(result: KaneResult): KaneResult {
  let sawSteps = false
  let memberCredits = 0
  let sawCredits = false
  const summed: StepTotals = { total: 0, passed: 0, failed: 0, skipped: 0, replayed: 0, authored: 0 }

  for (const member of result.members) {
    if (!member.logPath) continue
    let text: string
    try {
      text = readFileSync(member.logPath, "utf8")
    } catch {
      continue
    }
    const detail = parseMemberLog(text.split(/\r?\n/))
    if (detail.steps) {
      sawSteps = true
      summed.total += detail.steps.total
      summed.passed += detail.steps.passed
      summed.failed += detail.steps.failed
      summed.skipped += detail.steps.skipped
      summed.replayed += detail.steps.replayed
      summed.authored += detail.steps.authored
    }
    if (detail.credits !== undefined) {
      sawCredits = true
      memberCredits += detail.credits
    }
    if (member.failedStep === undefined && detail.failedStep !== undefined) member.failedStep = detail.failedStep
    if (detail.screenshot) member.screenshot = detail.screenshot
    if (detail.finalUrl) member.finalUrl = detail.finalUrl
    if (detail.observed) member.observed = detail.observed
    if (detail.failureReason && member.failure) member.failure.message = detail.failureReason
    if (detail.verdict && member.status !== "passed" && !result.verdict) result.verdict = detail.verdict
  }

  if (sawSteps) result.steps = summed
  // `testrun run` only prints flow-level totals; the money is in each flow's log.
  if (sawCredits) {
    result.credits = Math.round(memberCredits * 100) / 100
    result.creditsSource = "member_logs"
  }
  return result
}

export interface BriefOptions {
  attempt: number
  maxIterations: number
  command: string[]
}

/** The text the agent receives after a red run. Short, factual, actionable. */
export function buildFailureBrief(result: KaneResult, options: BriefOptions): string {
  const lines: string[] = []
  lines.push(`GREENLIGHT: RED (verification ${options.attempt} of ${options.maxIterations})`)
  lines.push(`Command: ${options.command.join(" ")}`)
  const passedFlows = result.members.filter((m) => m.status === "passed").length
  const totals = result.steps
    ? `${result.steps.passed} passed, ${result.steps.failed} failed of ${result.steps.total} steps`
    : result.members.length > 0
      ? `${passedFlows} passed, ${result.members.length - passedFlows} failed of ${result.members.length} flows`
      : `status ${result.status}`
  lines.push(`Exit ${result.exitCode} - ${totals} - ${result.durationS}s - ${result.credits} credits`)

  const failed = result.members.filter((member) => member.status !== "passed")
  for (const member of failed.slice(0, 5)) {
    const step = member.failedStep ?? member.failure?.stepIndex
    const where = step !== undefined ? ` (step ${step})` : ""
    lines.push(`FAIL ${member.name}${where}: ${member.failure?.message ?? "failed"}`)
    if (member.finalUrl) lines.push(`  url: ${member.finalUrl}`)
    const observed = Object.entries(member.observed ?? {})
    if (observed.length > 0) {
      lines.push(`  Kane saw: ${observed.map(([key, value]) => `${key}="${value}"`).join(", ")}`)
    }
    if (member.screenshot) lines.push(`  screenshot: ${member.screenshot}`)
  }

  if (result.verdict) {
    const v = result.verdict
    const kind = [v.family, v.category, v.severity].filter(Boolean).join(" / ")
    if (kind) lines.push(`Verdict: ${kind}`)
    if (v.bugTitle) lines.push(`Bug: ${v.bugTitle}`)
    if (v.oneLiner && v.oneLiner !== v.bugTitle) lines.push(v.oneLiner)
    if (v.rootCause) lines.push(`Root cause: ${v.rootCause}`)
    if (v.suggestion) lines.push(`Suggestion: ${v.suggestion}`)
    if (v.confidence !== undefined) lines.push(`Confidence: ${v.confidence}`)
  } else if (result.summary) {
    lines.push(`Summary: ${result.summary}`)
  }

  for (const pack of result.evidence.slice(-2)) lines.push(`Evidence: ${pack}`)

  lines.push("")
  lines.push("Fix the app, not the test. Do NOT edit flows/**, the recordings, or the plugin:")
  lines.push("the integrity guard voids the run and reports it in the Loop Receipt.")
  lines.push("When you believe it is fixed, call the greenlight_verify tool to run Kane again.")

  return lines.slice(0, MAX_BRIEF_LINES).join("\n")
}

export interface RunKaneOptions {
  root: string
  args: string[]
  timeoutMs: number
  onLine?: (event: Record<string, unknown>) => void
}

export interface RunKaneOutcome {
  result: KaneResult
  lines: string[]
  stderr: string
}

/** Spawn Kane, stream its NDJSON, and return the parsed verdict. */
export function runKane(options: RunKaneOptions): Promise<RunKaneOutcome> {
  const [binary, ...prefix] = resolveKaneCommand(options.root)
  const command = [binary, ...prefix, ...options.args]
  const startedAt = Date.now()

  return new Promise((resolve) => {
    let stdoutBuffer = ""
    const lines: string[] = []
    let stderr = ""
    let settled = false
    let timedOut = false

    const child = spawn(binary, [...prefix, ...options.args], {
      cwd: options.root,
      env: { ...process.env, KANE_CLI_USER_AGENT: "greenlight" },
      shell: false,
      windowsHide: true,
    })

    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill()
      } catch {
        /* ignore */
      }
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true })
      }
    }, options.timeoutMs)

    const finish = (exitCode: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (stdoutBuffer.trim()) {
        lines.push(stdoutBuffer)
        stdoutBuffer = ""
      }
      const result = enrichResult(
        parseKaneLines(lines, {
          command,
          exitCode,
          durationS: (Date.now() - startedAt) / 1000,
          timedOut,
        }),
      )
      resolve({ result, lines, stderr })
    }

    child.stdout?.setEncoding("utf8")
    child.stdout?.on("data", (chunk: string) => {
      stdoutBuffer += chunk
      const parts = stdoutBuffer.split("\n")
      stdoutBuffer = parts.pop() ?? ""
      for (const part of parts) {
        const line = part.trim()
        if (!line) continue
        lines.push(line)
        if (options.onLine && line.startsWith("{")) {
          try {
            options.onLine(JSON.parse(line) as Record<string, unknown>)
          } catch {
            /* ignore */
          }
        }
      }
    })

    child.stderr?.setEncoding("utf8")
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk
    })

    child.on("error", (error) => {
      stderr += String(error)
      finish(1)
    })
    child.on("close", (code) => finish(code ?? 1))
  })
}

/** `kane-cli balance` prints `Available credits: 10812.1962`. */
export function parseBalance(text: string): number | undefined {
  const match = text.match(/Available credits:\s*([\d.]+)/)
  return match ? Number(match[1]) : undefined
}
