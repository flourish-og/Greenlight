/**
 * Build fixtures/recorded/phase2-loop.json from real, committed Kane output.
 *
 * This is a *recording*: every entry is copied or summed from the files listed
 * in `provenance`, and the output is labelled RECORDED in the board. Nothing is
 * synthesized and no credits are spent to replay it.
 */
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), "utf8")
const sha = (path) => createHash("sha256").update(readFileSync(join(root, path))).digest("hex").slice(0, 16)
const lines = (text) =>
  text
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("{"))
    .map((line) => JSON.parse(line))

const redStream = "tests/fixtures/kane/phase2-testrun-2026-11-07.ndjson"
const redPromo = "tests/fixtures/kane/phase2-member-promo-2026-11-07.ndjson"
const redMembers = [
  "tests/fixtures/kane/phase2-member-cart-2026-11-07.ndjson",
  "tests/fixtures/kane/phase2-member-catalog-2026-11-07.ndjson",
  "tests/fixtures/kane/phase2-member-checkout-2026-11-07.ndjson",
  redPromo,
]
const redReceipt = ".greenlight/receipts/2026-11-07T00-07-52Z-hqAPNK7Y.json"
const greenReceipt = ".greenlight/receipts/2026-11-10T13-00-05Z-6wAPNK7Y.json"
const greenStream = "tests/fixtures/kane/phase2-green-suite-2026-11-10.ndjson"

const redEvents = lines(read(redStream))
const greenEvents = lines(read(greenStream))
const promoEvents = lines(read(redPromo))
const receipts = { red: JSON.parse(read(redReceipt)), green: JSON.parse(read(greenReceipt)) }

const byType = (events, type) => events.filter((event) => event.type === type)

function memberTotals(paths) {
  const totals = { total: 0, passed: 0, failed: 0, skipped: 0, authored: 0, replayed: 0, credits: 0 }
  for (const path of paths) {
    for (const event of lines(read(path))) {
      if (event.type === "test_md_summary" && event.steps) {
        totals.total += event.steps.total ?? 0
        totals.passed += event.steps.passed ?? 0
        totals.failed += event.steps.failed ?? 0
        totals.skipped += event.steps.skipped ?? 0
        totals.authored += event.steps.author_decisions ?? 0
        totals.replayed += event.steps.replay_decisions ?? 0
      }
      if (event.type === "run_end") {
        totals.credits += event.credits_consumed ?? 0
        if (event.verdict) totals.credits += event.verdict.credits_consumed ?? 0
      }
    }
  }
  totals.credits = Math.round(totals.credits * 100) / 100
  return totals
}

const redTotals = memberTotals(redMembers)
const redVerdict = promoEvents.find((event) => event.type === "run_end" && event.verdict)?.verdict

/**
 * The board's VerdictCard reads the camelCase `KaneVerdict` shape the plugin
 * produces; Kane's raw `run_end.verdict` is snake_case. Normalize so the replay
 * renders the bug title, one-liner, root cause and culprit step instead of
 * falling back to the placeholder "Failure".
 */
function normalizeVerdict(raw) {
  if (!raw) return undefined
  return {
    family: raw.family,
    category: raw.category,
    severity: raw.severity,
    bugTitle: raw.bug_title,
    rootCause: raw.root_cause,
    oneLiner: raw.one_liner,
    suggestion: raw.suggestion,
    confidence: raw.confidence,
    culpritStep: raw.culprit_step,
  }
}
const normalizedVerdict = normalizeVerdict(redVerdict)
const redSummary = promoEvents.find((event) => event.type === "test_md_summary")
const stepHeadings = new Map(
  promoEvents.filter((event) => event.type === "test_md_step_start").map((event) => [event.step_index, event.heading]),
)
const promoSteps = promoEvents.filter((event) => event.type === "test_md_step_end")

const entries = []

// ---- Red run: the promo feature meets Kane for the first time.
entries.push({
  at: receipts.red.startedAt,
  run: "red",
  type: "start",
  title: "Loop started: promo codes were just implemented",
  detail: receipts.red.objective,
})
const plan = byType(redEvents, "testrun_plan")[0]
entries.push({
  at: plan.ts,
  run: "red",
  type: "plan",
  title: `Plan resolved: ${plan.members.length} flows (1 has no recording yet)`,
  detail: plan.members.map((member) => member.path.split(/[\\/]/).pop()).join(", "),
})
const started = byType(redEvents, "testrun_start")[0]
entries.push({
  at: started.ts,
  run: "red",
  type: "start",
  title: `Replaying ${started.members.length} recorded flows`,
  detail: started.members.join(", "),
})
for (const member of byType(redEvents, "testrun_member_end")) {
  entries.push({
    at: member.ts,
    run: "red",
    type: "member",
    title: `${member.path.split(/[\\/]/).pop()} ${member.status} in ${member.duration_s}s`,
    detail: member.failure?.message,
  })
}
const authored = byType(redEvents, "testrun_authored_member_start")[0]
entries.push({
  at: authored.ts,
  run: "red",
  type: "authored",
  title: "No recording for promo_test.md - authoring 3 steps",
  detail: "The agent has to write the flow against the real app.",
})
for (const step of promoSteps) {
  entries.push({
    at: step.ts,
    run: "red",
    type: "step",
    title: `Step ${step.step_index}: ${stepHeadings.get(step.step_index) ?? "step"} - ${step.status}`,
    detail: `${step.duration_s}s${step.status === "failed" ? " - final verification failed" : ""}`,
  })
}
if (redVerdict) {
  entries.push({
    at: promoEvents.find((event) => event.verdict)?.ts ?? receipts.red.endedAt,
    run: "red",
    type: "verdict",
    title: `Verdict: ${redVerdict.bug_title}`,
    detail: redVerdict.one_liner,
    data: { verdict: normalizedVerdict, credits: redVerdict.credits_consumed },
  })
}
if (redSummary) {
  entries.push({
    at: redSummary.ts,
    run: "red",
    type: "summary",
    title: `promo_test.md: ${redSummary.steps.passed} passed, ${redSummary.steps.failed} failed (${redSummary.steps.author_decisions} authored)`,
    detail: `${redSummary.duration_s}s - ${redSummary.commit?.reason ?? ""}`,
  })
}
const redCoverage = byType(redEvents, "coverage")[0]
if (redCoverage) {
  entries.push({
    at: redCoverage.ts,
    run: "red",
    type: "evidence",
    title: "Evidence pack sealed",
    detail: redCoverage.pack,
  })
}
entries.push({
  at: byType(redEvents, "testrun_done")[0].ts,
  run: "red",
  type: "summary",
  title: `Suite: ${redTotals.passed} passed, ${redTotals.failed} failed of ${redTotals.total} steps - ${redTotals.credits} credits`,
  detail: `${redTotals.authored} authored, ${redTotals.replayed} replayed. Totals summed from the four member logs.`,
})
entries.push({
  at: receipts.red.endedAt ?? receipts.red.startedAt,
  run: "red",
  type: "receipt",
  title: "Loop Receipt: RED",
  detail: "Money bug confirmed. The agent gets the Failure Brief and fixes the app.",
  data: { receipt: { loopID: receipts.red.loopID, outcome: "red", totals: redTotals } },
})

// ---- Green run: the fix, replayed from the recordings.
entries.push({
  at: receipts.green.startedAt,
  run: "green",
  type: "start",
  title: "Fix landed: placeOrder now stores the discounted total",
  detail: receipts.green.objective,
})
for (const member of byType(greenEvents, "testrun_member_end")) {
  entries.push({
    at: member.ts,
    run: "green",
    type: "member",
    title: `${member.path.split(/[\\/]/).pop()} ${member.status} in ${member.duration_s}s`,
  })
}
const greenCoverage = byType(greenEvents, "coverage")[0]
if (greenCoverage) {
  entries.push({
    at: greenCoverage.ts,
    run: "green",
    type: "evidence",
    title: "Evidence pack sealed",
    detail: greenCoverage.pack,
  })
}
const greenSummary = byType(greenEvents, "testrun_summary")[0]
const greenDone = byType(greenEvents, "testrun_done")[0]
entries.push({
  at: greenDone.ts,
  run: "green",
  type: "summary",
  title: `Suite: ${greenSummary.totals.passed} passed of ${greenSummary.totals.tests} flows - 0 credits - ${Math.round(greenSummary.duration_s)}s`,
  detail: "Every step replayed. No LLM authored anything, so the suite cost nothing.",
})
entries.push({
  at: receipts.green.endedAt ?? receipts.green.startedAt,
  run: "green",
  type: "receipt",
  title: "Loop Receipt: GREEN",
  detail: `${receipts.green.totals.passed}/${receipts.green.totals.replayed} steps replayed, ${receipts.green.totals.credits} credits.`,
  data: { receipt: { loopID: receipts.green.loopID, outcome: "green", totals: receipts.green.totals } },
})

entries.sort((a, b) => String(a.at).localeCompare(String(b.at)))

const provenance = [
  redStream,
  redPromo,
  ...redMembers.slice(0, 3),
  redReceipt,
  greenStream,
  greenReceipt,
]

const replay = {
  v: 1,
  kind: "recorded",
  label: "Phase 2: promo codes, from a real red to a real green",
  recordedAt: "2026-11-10",
  provenance: provenance.map((path) => `${path} (sha256 ${sha(path)})`),
  entries,
}

mkdirSync(join(root, "fixtures", "recorded"), { recursive: true })
writeFileSync(join(root, "fixtures", "recorded", "phase2-loop.json"), JSON.stringify(replay, null, 2) + "\n", "utf8")
console.log(`wrote fixtures/recorded/phase2-loop.json - ${entries.length} entries`)
