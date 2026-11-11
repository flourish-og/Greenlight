import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import type { KaneResult } from "../../.opencode/plugins/greenlight/kane.ts"
import {
  addAttempt,
  attemptFromResult,
  newReceipt,
  renderReceiptMarkdown,
  writeReceipt,
  writeRunLog,
} from "../../.opencode/plugins/greenlight/receipt.ts"

const roots: string[] = []

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "gl-receipt-"))
  roots.push(dir)
  return dir
}

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function result(overrides: Partial<KaneResult> = {}): KaneResult {
  return {
    command: ["node", "kane-cli.cjs", "testrun", "run"],
    exitCode: 0,
    started: true,
    status: "passed",
    durationS: 99,
    credits: 0.71,
    summary: "All checks passed.",
    members: [
      { path: "flows/store/cart_test.md", name: "cart_test.md", status: "passed" },
      { path: "flows/store/catalog_test.md", name: "catalog_test.md", status: "passed" },
    ],
    steps: { total: 11, passed: 11, failed: 0, skipped: 0, replayed: 11, authored: 0 },
    evidence: [".testmuai/evidence/abc.evidence"],
    sessionDirs: [],
    failureBrief: "",
    ...overrides,
  }
}

function receipt() {
  return newReceipt({
    loopID: "gl-abc123",
    sessionID: "ses_xyz",
    objective: "verify the store suite",
    trigger: { kind: "auto", files: ["apps/store/src/App.tsx"], reason: "app code changed" },
    target: { url: "http://localhost:5173", reachable: true, startedByPlugin: false },
    integrity: { ok: true, checked: 4, changed: [] },
  })
}

test("a new receipt starts empty and red until the first run finishes", () => {
  const built = receipt()
  assert.equal(built.v, 1)
  assert.equal(built.outcome, "red")
  assert.deepEqual(built.attempts, [])
  assert.deepEqual(built.totals, { credits: 0, durationS: 0, authored: 0, replayed: 0, passed: 0, failed: 0 })
})

test("attempts accumulate credits, durations and step counts", () => {
  const built = receipt()
  addAttempt(built, attemptFromResult(1, "suite", result({ credits: 0.71, durationS: 99 }), "2026-11-07T00:00:00.000Z"))
  addAttempt(
    built,
    attemptFromResult(
      2,
      "suite",
      result({
        credits: 1.67,
        durationS: 131,
        steps: { total: 11, passed: 10, failed: 1, skipped: 0, replayed: 10, authored: 1 },
      }),
      "2026-11-07T00:05:00.000Z",
    ),
  )

  assert.equal(built.attempts.length, 2)
  assert.equal(built.totals.credits, 2.38)
  assert.equal(built.totals.durationS, 230)
  assert.equal(built.totals.replayed, 21)
  assert.equal(built.totals.authored, 1)
  assert.equal(built.totals.passed, 21)
  assert.equal(built.totals.failed, 1)
  assert.equal(built.attempts[0]?.kind, "suite")
})

test("markdown shows the outcome, the table and the totals", () => {
  const built = receipt()
  built.outcome = "green"
  addAttempt(built, attemptFromResult(1, "suite", result(), "2026-11-07T00:00:00.000Z"))
  const markdown = renderReceiptMarkdown(built)

  assert.ok(markdown.startsWith("# Loop Receipt - GREEN"))
  assert.ok(markdown.includes("| # | exit | status | tests | authored | replayed | seconds | credits |"))
  assert.ok(markdown.includes("| 1 | 0 | passed | 11/11 | 0 | 11 | 99 | 0.71 |"))
  assert.ok(markdown.includes("**0.71 credits**"))
  assert.ok(markdown.includes("http://localhost:5173 (reachable)"))
})

test("a blocked receipt says so in the markdown", () => {
  const built = receipt()
  built.outcome = "integrity_blocked"
  built.integrity = { ok: false, checked: 4, changed: ["flows/store/cart_test.md"] }
  const markdown = renderReceiptMarkdown(built)
  assert.ok(markdown.startsWith("# Loop Receipt - INTEGRITY_BLOCKED"))
  assert.ok(markdown.includes("Integrity: BLOCKED - protected files changed: flows/store/cart_test.md"))
})

test("writeReceipt writes json, markdown and one index line", async () => {
  const root = tempRoot()
  const built = receipt()
  built.outcome = "green"
  addAttempt(built, attemptFromResult(1, "suite", result(), "2026-11-07T00:00:00.000Z"))

  const written = await writeReceipt(root, ".greenlight/receipts", built)

  assert.ok(existsSync(written.jsonPath))
  assert.ok(existsSync(written.markdownPath))
  const json = JSON.parse(readFileSync(written.jsonPath, "utf8")) as { v: number; outcome: string }
  assert.equal(json.v, 1)
  assert.equal(json.outcome, "green")

  const index = readFileSync(join(root, ".greenlight/receipts/index.ndjson"), "utf8").trim().split("\n")
  assert.equal(index.length, 1)
  const entry = JSON.parse(index[0] ?? "{}") as { outcome: string; credits: number; loopID: string }
  assert.equal(entry.outcome, "green")
  assert.equal(entry.credits, 0.71)
  assert.equal(entry.loopID, "gl-abc123")
})

test("writeRunLog keeps the raw NDJSON beside the receipts and returns a repo path", async () => {
  const root = tempRoot()
  const path = await writeRunLog(root, ".greenlight/receipts", "gl-abc123", 2, [
    '{"type":"stream_start"}',
    '{"type":"run_end","status":"failed"}',
  ])

  assert.equal(path, path.replaceAll("\\", "/"))
  assert.ok(path.startsWith(".greenlight/runs/") && path.endsWith("-a2.ndjson"))
  const text = readFileSync(join(root, path), "utf8")
  assert.equal(text.trim().split("\n").length, 2)
  assert.ok(text.endsWith("\n"))

  const built = receipt()
  const attempt = attemptFromResult(2, "suite", result(), "2026-11-07T00:00:00.000Z")
  attempt.stream = path
  addAttempt(built, attempt)
  assert.ok(renderReceiptMarkdown(built).includes(`Raw NDJSON (attempt 2): \`${path}\``))
})
