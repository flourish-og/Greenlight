import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_CONFIG, type GreenlightConfig } from "../../.opencode/plugins/greenlight/config.ts"
import type { KaneResult } from "../../.opencode/plugins/greenlight/kane.ts"
import { decide, newSessionState, shouldAutoVerify, type SessionState } from "../../.opencode/plugins/greenlight/loop.ts"

function config(overrides: Partial<GreenlightConfig["loop"]> = {}): GreenlightConfig {
  return { ...DEFAULT_CONFIG, loop: { ...DEFAULT_CONFIG.loop, ...overrides } }
}

function result(overrides: Partial<KaneResult> = {}): KaneResult {
  return {
    command: ["kane-cli", "testrun", "run"],
    exitCode: 0,
    started: true,
    status: "passed",
    durationS: 100,
    credits: 1,
    summary: "",
    members: [],
    steps: { total: 11, passed: 11, failed: 0, skipped: 0, replayed: 11, authored: 0 },
    evidence: [],
    sessionDirs: [],
    failureBrief: "the brief",
    ...overrides,
  }
}

function state(patch: Partial<SessionState> = {}): SessionState {
  return { ...newSessionState("ses_test", "make promo codes work", "gl-test"), ...patch }
}

test("green stops the loop and reports what Kane verified", () => {
  const decision = decide(result(), state({ attempts: 1 }), config())
  assert.equal(decision.action, "green")
  assert.ok(decision.message.includes("GREENLIGHT: GREEN"))
  assert.ok(decision.message.includes("11/11 checks passed"))
  assert.ok(decision.message.includes("attempt 1"))
})

test("red hands the failure brief back to the agent", () => {
  const decision = decide(result({ status: "failed", exitCode: 1 }), state({ attempts: 0 }), config())
  assert.equal(decision.action, "prompt")
  assert.equal(decision.message, "the brief")
})

test("red stops at maxIterations instead of looping forever", () => {
  const decision = decide(result({ status: "failed", exitCode: 1 }), state({ attempts: 3 }), config())
  assert.equal(decision.action, "stop")
  assert.equal(decision.action === "stop" && decision.outcome, "max_iterations")
})

test("red stops when this loop costs more than maxCreditsPerLoop", () => {
  const decision = decide(
    result({ status: "failed", exitCode: 1, credits: 81 }),
    state({ attempts: 1, credits: 0 }),
    config({ maxCreditsPerLoop: 80 }),
  )
  assert.equal(decision.action === "stop" && decision.outcome, "budget_exhausted")
  assert.ok(decision.message.includes("81"))
})

test("red stops when the session budget is spent", () => {
  const decision = decide(
    result({ status: "failed", exitCode: 1, credits: 10 }),
    state({ attempts: 1, credits: 205 }),
    config({ maxCreditsPerSession: 200 }),
  )
  assert.equal(decision.action === "stop" && decision.outcome, "budget_exhausted")
})

test("a run that never started and a killed run both stop without a verdict", () => {
  const notStarted = decide(result({ status: "not_started", started: false, exitCode: 2 }), state(), config())
  assert.equal(notStarted.action === "stop" && notStarted.outcome, "not_started")
  assert.ok(notStarted.message.includes("no credits used"))

  const timedOut = decide(result({ status: "timeout" }), state(), config())
  assert.equal(timedOut.action === "stop" && timedOut.outcome, "cancelled")
})

test("auto-verify needs enabled config, a session, no run in flight and a real edit", () => {
  const enabled = config()
  assert.deepEqual(shouldAutoVerify(state({ dirty: new Set(["apps/store/src/App.tsx"]) }), config({ auto: false }), 1), {
    run: false,
    reason: "auto loop disabled in greenlight.config.json",
  })
  assert.equal(shouldAutoVerify(undefined, enabled, 1).run, false)
  assert.equal(shouldAutoVerify(state({ inFlight: true, dirty: new Set(["a"]) }), enabled, 1).run, false)
  assert.equal(shouldAutoVerify(state({ outcome: "green", dirty: new Set(["a"]) }), enabled, 1).run, false)
  assert.equal(shouldAutoVerify(state({ attempts: 3, dirty: new Set(["a"]) }), enabled, 1).run, false)
  assert.equal(shouldAutoVerify(state({ dirty: new Set() }), enabled, 0).run, false)
})

test("after a red brief, an untouched app is not re-run", () => {
  const decision = shouldAutoVerify(state({ awaitingFix: true, attempts: 1 }), config(), 0)
  assert.equal(decision.run, false)
  assert.ok(decision.reason.includes("not spending credits"))

  const fixed = shouldAutoVerify(state({ awaitingFix: true, attempts: 1 }), config(), 2)
  assert.equal(fixed.run, true)
  assert.equal(fixed.reason, "app code changed")
})

test("new app edits after a red run re-open a finished loop", () => {
  const decision = shouldAutoVerify(state({ outcome: "red", dirty: new Set(["apps/store/src/App.tsx"]) }), config(), 1)
  assert.equal(decision.run, true)
})

test("stalled outcome blocks further spending until the agent edits", () => {
  const decision = shouldAutoVerify(state({ outcome: "stalled", dirty: new Set(["apps/store/src/App.tsx"]) }), config(), 1)
  assert.equal(decision.run, false)
  assert.ok(decision.reason.includes("stalled"))
})
