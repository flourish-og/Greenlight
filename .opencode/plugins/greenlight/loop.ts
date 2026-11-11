/**
 * The decision half of the loop, kept pure so it can be unit-tested without
 * OpenCode and without spending Kane credits.
 */
import type { GreenlightConfig } from "./config.ts"
import type { KaneResult } from "./kane.ts"
import type { LoopOutcome } from "./receipt.ts"

export interface SessionState {
  sessionID: string
  startedAt: string
  /** Verification passes done so far, including the one being decided. */
  attempts: number
  /** Credits spent by this loop so far, including the run being decided. */
  credits: number
  /** Repo-relative app files edited since the last verification. */
  dirty: Set<string>
  /** Status of the last verification, if any. */
  lastStatus?: KaneResult["status"]
  /** True while a Kane run is in flight. */
  inFlight: boolean
  /** True when we prompted the agent after a red run and are waiting for its turn. */
  awaitingFix: boolean
  outcome?: LoopOutcome
  integrityBaseline?: Record<string, string>
  loopID: string
  objective: string
}

export function newSessionState(sessionID: string, objective: string, loopID: string): SessionState {
  return {
    sessionID,
    startedAt: new Date().toISOString(),
    attempts: 0,
    credits: 0,
    dirty: new Set(),
    inFlight: false,
    awaitingFix: false,
    loopID,
    objective,
  }
}

export type Decision =
  | { action: "green"; message: string }
  | { action: "prompt"; message: string }
  | { action: "stop"; outcome: LoopOutcome; message: string }

export function decide(result: KaneResult, state: SessionState, config: GreenlightConfig): Decision {
  const totals = `${result.steps?.passed ?? 0}/${result.steps?.total ?? result.members.length} checks passed`

  if (result.status === "passed") {
    return {
      action: "green",
      message: [
        "GREENLIGHT: GREEN",
        `${totals} in ${result.durationS}s (${result.credits} credits, attempt ${state.attempts}).`,
        result.evidence.length ? `Evidence: ${result.evidence.slice(-1)[0]}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    }
  }

  if (result.status === "not_started") {
    return {
      action: "stop",
      outcome: "not_started",
      message:
        "GREENLIGHT: Kane did not start (sign-in, config, or no start URL). Nothing ran, no credits used. Fix the environment, then run greenlight_verify again.",
    }
  }

  if (result.status === "timeout") {
    return {
      action: "stop",
      outcome: "cancelled",
      message: `GREENLIGHT: Kane was killed after ${Math.round(result.durationS)}s. The loop stopped without a verdict.`,
    }
  }

  if (state.credits > config.loop.maxCreditsPerSession) {
    return {
      action: "stop",
      outcome: "budget_exhausted",
      message: `GREENLIGHT: stopped - the session budget of ${config.loop.maxCreditsPerSession} credits is spent (${state.credits}).`,
    }
  }

  if (result.credits > config.loop.maxCreditsPerLoop) {
    return {
      action: "stop",
      outcome: "budget_exhausted",
      message: `GREENLIGHT: stopped - one verification cost ${result.credits} credits, over the ${config.loop.maxCreditsPerLoop} credit ceiling.`,
    }
  }

  if (state.attempts >= config.loop.maxIterations) {
    return {
      action: "stop",
      outcome: "max_iterations",
      message: `GREENLIGHT: stopped after ${state.attempts} verification passes without green. The app still fails; see the latest receipt.`,
    }
  }

  return { action: "prompt", message: result.failureBrief }
}

/** Should a turn boundary trigger an automatic verification? */
export function shouldAutoVerify(
  state: SessionState | undefined,
  config: GreenlightConfig,
  appEditsSinceRun: number,
): { run: boolean; reason: string } {
  if (!config.loop.auto) return { run: false, reason: "auto loop disabled in greenlight.config.json" }
  if (!state) return { run: false, reason: "session never edited app code" }
  if (state.inFlight) return { run: false, reason: "a verification is already running" }
  if (state.outcome && state.outcome !== "red") return { run: false, reason: `loop already finished (${state.outcome})` }
  if (state.attempts >= config.loop.maxIterations) return { run: false, reason: "max iterations reached" }
  if (state.awaitingFix && appEditsSinceRun === 0) {
    return { run: false, reason: "red was sent to the agent but no app file changed - not spending credits" }
  }
  if (appEditsSinceRun === 0) return { run: false, reason: "no app edits since the last verification" }
  return { run: true, reason: "app code changed" }
}
