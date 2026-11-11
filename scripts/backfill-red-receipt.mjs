/**
 * Regenerate the Phase 2 RED receipt from the committed, real Kane fixtures.
 *
 * The 00:07 receipt was written by the pre-fix parser: it dropped the authored
 * promo flow, the bug verdict, and the credit total (it claimed "11/11 passed").
 * The real run is fully preserved in `tests/fixtures/kane/phase2-*`, so this
 * rebuilds the receipt by running the *current* parser over that exact data -
 * the same code path that produces today's receipts. Nothing is invented; the
 * verdict, steps, member logs and credit total all come from the committed files.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseKaneLines, enrichResult } from "../.opencode/plugins/greenlight/kane.ts"
import {
  newReceipt,
  attemptFromResult,
  addAttempt,
  renderReceiptMarkdown,
} from "../.opencode/plugins/greenlight/receipt.ts"

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), "utf8")

const suiteFixture = "tests/fixtures/kane/phase2-testrun-2026-11-07.ndjson"
const memberFixtures = {
  "cart_test.md": "tests/fixtures/kane/phase2-member-cart-2026-11-07.ndjson",
  "catalog_test.md": "tests/fixtures/kane/phase2-member-catalog-2026-11-07.ndjson",
  "checkout_test.md": "tests/fixtures/kane/phase2-member-checkout-2026-11-07.ndjson",
  "promo_test.md": "tests/fixtures/kane/phase2-member-promo-2026-11-07.ndjson",
}

const receiptFile = ".greenlight/receipts/2026-11-07T00-07-52Z-hqAPNK7Y.json"
const mdFile = receiptFile.replace(/\.json$/, ".md")
const indexFile = ".greenlight/receipts/index.ndjson"

// Original metadata, preserved from the historical receipt (already correct).
const original = JSON.parse(read(receiptFile))

const result = parseKaneLines(read(suiteFixture).split(/\r?\n/), {
  command: original.attempts[0].command,
  exitCode: 1,
  durationS: 390.7,
})
for (const member of result.members) {
  const fixture = memberFixtures[member.name]
  if (fixture) member.logPath = join(root, fixture)
}
enrichResult(result)

// Rebuild the receipt through the same helpers the plugin uses.
const receipt = newReceipt({
  loopID: original.loopID,
  sessionID: original.sessionID,
  objective: original.objective,
  trigger: original.trigger,
  target: original.target,
  integrity: original.integrity,
})
receipt.startedAt = original.startedAt
receipt.endedAt = original.endedAt
receipt.outcome = "red"

const attempt = attemptFromResult(1, "suite", result, original.startedAt)
attempt.startedAt = original.attempts[0].startedAt
attempt.endedAt = original.attempts[0].endedAt
attempt.stream = suiteFixture
attempt.summary = result.verdict?.oneLiner ?? result.members.find((m) => m.status !== "passed")?.failure?.message ?? ""
addAttempt(receipt, attempt)

const json = JSON.stringify(receipt, null, 2) + "\n"
writeFileSync(join(root, receiptFile), json, "utf8")
writeFileSync(join(root, mdFile), renderReceiptMarkdown(receipt), "utf8")

// Patch the index.ndjson entry for this receipt.
const entries = read(indexFile)
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
for (const entry of entries) {
  if (entry.json === "2026-11-07T00-07-52Z-hqAPNK7Y.json") {
    entry.credits = receipt.totals.credits
    entry.durationS = receipt.totals.durationS
  }
}
writeFileSync(join(root, indexFile), entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8")

console.log("rebuilt red receipt:")
console.log(JSON.stringify(
  {
    outcome: receipt.outcome,
    totals: receipt.totals,
    verdict: result.verdict,
    members: result.members.map((m) => `${m.name}:${m.status}${m.authored ? "(authored)" : ""}`),
    creditsSource: result.creditsSource,
  },
  null,
  2,
))
