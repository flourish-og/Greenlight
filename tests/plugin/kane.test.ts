import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join, resolve } from "node:path"
import { test } from "node:test"
import {
  buildFailureBrief,
  enrichResult,
  parseKaneLines,
  parseMemberLog,
  type KaneMember,
  type KaneResult,
} from "../../.opencode/plugins/greenlight/kane.ts"

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)))

/** Evidence written by PowerShell 5.1 redirection is UTF-16LE; Kane's own stdout is UTF-8. */
function readText(path: string): string {
  const buffer = readFileSync(join(repoRoot, path))
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.toString("utf16le")
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return buffer.toString("utf8").slice(1)
  return buffer.toString("utf8")
}

function lines(...parts: string[]): string[] {
  return parts.flatMap((part) => readText(part).split(/\r?\n/))
}

const greenSuite = lines("docs/evidence/phase1-ratchet-1-2026-11-06.ndjson")
const redSuite = lines("docs/evidence/phase1-ratchet-red-2026-11-06.ndjson")
const smoke = lines("docs/evidence/phase0-smoke-run-2026-11-06.ndjson")

const redMemberLog = readText("tests/fixtures/kane/member-red-cart-2026-11-06.ndjson").split(/\r?\n/)
const greenMemberLog = readText("tests/fixtures/kane/member-green-cart-2026-11-06.ndjson").split(/\r?\n/)

/** Real Phase 2 run `9b29d7db-fd64-442e-947f-93b7b82eb7e4`: 3 replayed flows + 1 authored (red) flow. */
const phase2Suite = lines("tests/fixtures/kane/phase2-testrun-2026-11-07.ndjson")
const phase2Logs: Record<string, string> = {
  "cart_test.md": join(repoRoot, "tests/fixtures/kane/phase2-member-cart-2026-11-07.ndjson"),
  "catalog_test.md": join(repoRoot, "tests/fixtures/kane/phase2-member-catalog-2026-11-07.ndjson"),
  "checkout_test.md": join(repoRoot, "tests/fixtures/kane/phase2-member-checkout-2026-11-07.ndjson"),
  "promo_test.md": join(repoRoot, "tests/fixtures/kane/phase2-member-promo-2026-11-07.ndjson"),
}
const promoLog = readText("tests/fixtures/kane/phase2-member-promo-2026-11-07.ndjson").split(/\r?\n/)

/** Real Phase 2 green suite `ffbc6251-…`: 4 flows, 14 steps, nothing authored, 0 credits. */
const phase2GreenSuite = lines("tests/fixtures/kane/phase2-green-suite-2026-11-10.ndjson")

/** Real red ratchet run `09491f13-8018-4ba5-a021-14ca9fc6b746`, exit 1. */
function redResult(): KaneResult {
  return parseKaneLines(redSuite, { command: ["kane-cli", "testrun", "run"], exitCode: 1, durationS: 209 })
}

const memberLogPath = join(repoRoot, "tests/fixtures/kane/member-red-cart-2026-11-06.ndjson")

test("a real green ratchet stream parses as 3/3 flows, passed", () => {
  const result = parseKaneLines(greenSuite, {
    command: ["kane-cli", "testrun", "run"],
    exitCode: 0,
    durationS: 120,
  })

  assert.equal(result.started, true)
  assert.equal(result.status, "passed")
  assert.equal(result.exitCode, 0)
  assert.equal(result.durationS, 131.3)
  assert.equal(result.members.length, 3)
  assert.deepEqual(
    result.members.map((member) => `${member.name}:${member.status}`).sort(),
    ["cart_test.md:passed", "catalog_test.md:passed", "checkout_test.md:passed"],
  )
  assert.equal(result.steps?.total, 3)
  assert.equal(result.steps?.passed, 3)
  assert.equal(result.steps?.failed, 0)
  assert.equal(result.steps?.authored, 0)
  assert.ok(result.evidence.some((path) => path.includes("f304dda6-cd21-4eb5-a21c-344c0df82575")))
  assert.ok(result.members.every((member) => member.logPath?.endsWith("events.ndjson")))
})

test("the real Phase 2 green suite is 4 passed flows with nothing authored", () => {
  const result = parseKaneLines(phase2GreenSuite, {
    command: ["kane-cli", "testrun", "run"],
    exitCode: 0,
    durationS: 279.7,
  })

  assert.equal(result.started, true)
  assert.equal(result.status, "passed")
  assert.equal(result.members.length, 4)
  assert.ok(result.members.every((member) => member.status === "passed"))
  assert.equal(result.members.filter((member) => member.authored).length, 0)
  assert.deepEqual(
    result.members.map((member) => member.name).sort(),
    ["cart_test.md", "catalog_test.md", "checkout_test.md", "promo_test.md"],
  )
  assert.ok(result.evidence.some((path) => path.includes("ffbc6251-5912-413e-90de-c2b9f105ea3e")))
})

test("a real red ratchet stream keeps the failing flow and its step", () => {
  const result = redResult()

  assert.equal(result.started, true)
  assert.equal(result.status, "failed")
  assert.equal(result.summary, "")
  assert.equal(result.members.length, 3)

  const failed = result.members.filter((member) => member.status !== "passed")
  assert.equal(failed.length, 1)
  assert.equal(failed[0]?.name, "cart_test.md")
  assert.equal(failed[0]?.failure?.message, "action_failed: click @ step 1")
  assert.equal(failed[0]?.failure?.stepIndex, 4)

  assert.equal(result.steps?.total, 3)
  assert.equal(result.steps?.passed, 2)
  assert.equal(result.steps?.failed, 1)
})

test("a stream with no start event is not_started, not failed", () => {
  const result = parseKaneLines([], { command: ["kane-cli"], exitCode: 2, durationS: 0.2 })
  assert.equal(result.started, false)
  assert.equal(result.status, "not_started")
  assert.equal(result.credits, 0)
  assert.equal(result.members.length, 0)
})

test("a killed run is a timeout regardless of exit code", () => {
  const result = parseKaneLines(
    ['{"type":"stream_start","cli_version":"0.10.2","surface":"testrun"}'],
    { command: ["kane-cli"], exitCode: 1, durationS: 900, timedOut: true },
  )
  assert.equal(result.started, true)
  assert.equal(result.status, "timeout")
})

test("a real single-objective smoke run parses with credits and session dir", () => {
  const result = parseKaneLines(smoke, { command: ["kane-cli", "run"], exitCode: 0, durationS: 28.3 })
  assert.equal(result.status, "passed")
  assert.equal(result.members.length, 0)
  assert.equal(result.steps, undefined)
  assert.equal(result.credits, 11.28)
  assert.equal(result.sessionDirs.length, 1)
  assert.ok(result.summary.includes("Example Domain"))
})

test("garbage lines and unknown events never throw", () => {
  const result = parseKaneLines(
    ["not json", '{"type":"stream_start"}', '{"type":"future.thing","x":1}', "{broken"],
    { command: ["kane-cli"], exitCode: 0, durationS: 1 },
  )
  assert.equal(result.status, "passed")
  assert.equal(result.members.length, 0)
})

test("a real failing member log yields the failing step, reason, screenshot and values", () => {
  const detail = parseMemberLog(redMemberLog)

  assert.equal(detail.steps?.total, 4)
  assert.equal(detail.steps?.passed, 3)
  assert.equal(detail.steps?.failed, 1)
  assert.equal(detail.steps?.replayed, 4)
  assert.equal(detail.steps?.authored, 0)
  assert.equal(detail.failedStep, 4)
  assert.equal(detail.failureReason, "action_failed: click @ step 1")
  assert.equal(detail.finalUrl, "http://localhost:5173/")
  assert.ok(detail.screenshot?.endsWith("step_001.png"))
  assert.equal(detail.observed?.subtotal_check, "$96.50")
})

test("a real passing member log replays every step with zero authoring", () => {
  const detail = parseMemberLog(greenMemberLog)
  assert.equal(detail.steps?.total, 4)
  assert.equal(detail.steps?.passed, 4)
  assert.equal(detail.steps?.replayed, 4)
  assert.equal(detail.steps?.authored, 0)
  assert.equal(detail.failedStep, undefined)
  assert.equal(detail.failureReason, undefined)
})

test("a real Phase 2 stream keeps the authored flow beside the replayed ones", () => {
  const result = parseKaneLines(phase2Suite, {
    command: ["kane-cli", "testrun", "run"],
    exitCode: 1,
    durationS: 385.6,
  })

  assert.equal(result.started, true)
  assert.equal(result.status, "failed")
  assert.equal(result.members.length, 4)

  const promo = result.members.find((member) => member.name === "promo_test.md")
  assert.equal(promo?.authored, true)
  assert.equal(promo?.status, "failed")
  assert.equal(promo?.failure?.stepIndex, 3)
  assert.ok(promo?.logPath?.includes("0b4b8d74-9fdf-4afb-912d-a5ab5dd1cf10"))

  const replayed = result.members.filter((member) => !member.authored)
  assert.equal(replayed.length, 3)
  assert.ok(replayed.every((member) => member.status === "passed"))

  // Before logs are read, only the flow totals from `testrun_summary` exist.
  assert.equal(result.steps?.total, 4)
  assert.equal(result.steps?.passed, 3)
  assert.equal(result.steps?.authored, 1)
  // `testrun run` never prints credits; only the member logs know.
  assert.equal(result.credits, 0)
  assert.ok(result.evidence.some((path) => path.endsWith("e1133c75-9167-41da-a121-088e0cbdb827.evidence")))
})

test("a real authored member log carries the bug verdict and both credit calls", () => {
  const detail = parseMemberLog(promoLog)

  assert.equal(detail.steps?.total, 3)
  assert.equal(detail.steps?.passed, 2)
  assert.equal(detail.steps?.failed, 1)
  assert.equal(detail.steps?.authored, 3)
  assert.equal(detail.steps?.replayed, 0)
  assert.equal(detail.failedStep, 3)
  assert.equal(detail.failureReason, 'Final verification failed: "the confirmation page shows "Total paid: $37.80""')

  assert.equal(detail.verdict?.family, "application_issue")
  assert.equal(detail.verdict?.category, "ui_data_defect")
  assert.equal(detail.verdict?.severity, "major")
  assert.equal(detail.verdict?.bugTitle, "Confirmation total omits applied promo discount")
  assert.equal(detail.verdict?.confidence, 0.98)
  assert.equal(detail.verdict?.culpritStep, "2-12")

  // 17.667905 + 18.9024275 + 30.38324 authored runs + 4.37045 for the verdict call.
  assert.equal(detail.credits, 71.3240225)
})

test("enrichResult reads every flow log: 4 flows, 14 steps, 13 passed, 1 failed", () => {
  const result = parseKaneLines(phase2Suite, {
    command: ["kane-cli", "testrun", "run"],
    exitCode: 1,
    durationS: 385.6,
  })
  for (const member of result.members) {
    member.logPath = phase2Logs[member.name]
  }

  enrichResult(result)

  assert.equal(result.members.length, 4)
  assert.equal(result.steps?.total, 14)
  assert.equal(result.steps?.passed, 13)
  assert.equal(result.steps?.failed, 1)
  assert.equal(result.steps?.authored, 3)
  assert.equal(result.steps?.replayed, 11)
  assert.equal(result.credits, 71.32)
  assert.equal(result.creditsSource, "member_logs")

  const promo = result.members.find((member) => member.name === "promo_test.md")
  assert.equal(promo?.failedStep, 3)
  assert.equal(result.verdict?.bugTitle, "Confirmation total omits applied promo discount")
  assert.equal(result.verdict?.severity, "major")
})

test("the failure brief leads with the real bug, not just the exit code", () => {
  const result = parseKaneLines(phase2Suite, {
    command: ["kane-cli", "testrun", "run"],
    exitCode: 1,
    durationS: 385.6,
  })
  for (const member of result.members) member.logPath = phase2Logs[member.name]
  enrichResult(result)

  const brief = buildFailureBrief(result, { attempt: 1, maxIterations: 3, command: result.command })
  assert.ok(brief.includes("13 passed, 1 failed of 14 steps"))
  assert.ok(brief.includes("FAIL promo_test.md (step 3)"))
  assert.ok(brief.includes("Verdict: application_issue / ui_data_defect / major"))
  assert.ok(brief.includes("Bug: Confirmation total omits applied promo discount"))
  assert.ok(brief.includes("The order confirmation charged $42.00 even though the checkout total was $37.80."))
})

test("enrichResult merges a member log into step-level totals", () => {
  const result = redResult()
  for (const member of result.members) member.logPath = undefined
  const cart = result.members.find((member) => member.name === "cart_test.md") as KaneMember
  cart.logPath = memberLogPath

  enrichResult(result)

  assert.equal(result.steps?.total, 4)
  assert.equal(result.steps?.passed, 3)
  assert.equal(result.steps?.failed, 1)
  assert.equal(result.steps?.replayed, 4)
  assert.equal(cart.failedStep, 4)
  assert.ok(cart.screenshot?.endsWith("step_001.png"))
  assert.equal(cart.observed?.subtotal_check, "$96.50")
})

test("enrichResult tolerates missing logs and keeps the flow totals", () => {
  const result = redResult()
  const before = { ...result.steps }
  for (const member of result.members) member.logPath = join(repoRoot, "tests/fixtures/kane/missing.ndjson")
  enrichResult(result)
  assert.deepEqual(result.steps, before)
})

test("the failure brief is short, factual and tells the agent what not to touch", () => {
  const result = redResult()
  for (const member of result.members) member.logPath = undefined
  const cart = result.members.find((member) => member.name === "cart_test.md") as KaneMember
  cart.logPath = memberLogPath
  enrichResult(result)
  result.failureBrief = buildFailureBrief(result, {
    attempt: 1,
    maxIterations: 3,
    command: result.command,
  })

  const brief = result.failureBrief
  assert.ok(brief.startsWith("GREENLIGHT: RED (verification 1 of 3)"))
  assert.ok(brief.includes("3 passed, 1 failed of 4 steps"))
  assert.ok(brief.includes("FAIL cart_test.md (step 4)"))
  assert.ok(brief.includes("action_failed: click @ step 1"))
  assert.ok(brief.includes('Kane saw: subtotal_check="$96.50"'))
  assert.ok(brief.includes("screenshot:") && brief.includes("step_001.png"))
  assert.ok(brief.includes("Evidence:"))
  assert.ok(brief.includes("Fix the app, not the test."))
  assert.ok(brief.includes("greenlight_verify"))
  assert.ok(brief.split("\n").length <= 40)
})

test("the failure brief does not pretend a non-started run has flows", () => {
  const result = parseKaneLines([], { command: ["kane-cli"], exitCode: 2, durationS: 0 })
  const brief = buildFailureBrief(result, { attempt: 1, maxIterations: 3, command: result.command })
  assert.ok(brief.includes("status not_started"))
  assert.ok(!brief.includes("of 0 flows"))
})
