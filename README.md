# GREENLIGHT

**Red → agent → Green. Nothing ships until Kane says so.**

GREENLIGHT is an OpenCode plugin that closes the loop between a coding agent and
[Kane CLI](https://www.testmuai.com/kane-cli-agent/). The agent edits the app;
Kane CLI runs the committed browser flows against the real app; a red run comes
back to the same agent as a Failure Brief; a green run writes a Loop Receipt.
The agent is never allowed to edit the tests into passing.

**Demo video (3 min):** https://youtu.be/6Docr4JNGQI · **Live app:** https://flourish-og.github.io/Greenlight/

This repo is the whole submission:

| Part | Where | What it is |
|---|---|---|
| **Plugin** | `.opencode/plugins/greenlight/` | the loop: tool + auto trigger, integrity guard, credit budget, receipts |
| **Loop Board** | `apps/board/` | live tail of the loop + a recorded replay of the real red→green run |
| **Storefront** | `apps/store/` | a deterministic Vite + React demo target; every feature was built through the loop |

The headline result: on its first real run the loop caught a **money bug** the
agent had just written — the cart and checkout showed `Total: $37.80`, but the
confirmation charged `$42.00`. Kane's verdict was
`application_issue / ui_data_defect / major`, confidence `0.98`. The agent fixed
`placeOrder` to store the discounted total, and the suite replayed **14/14 in
279.7 s for 0 credits**.

Three features were built *through* the loop — promo codes, **free shipping over
$75**, and **gift wrap (+$4.00)**. Shipping moved two earlier flow totals, the
agent updated those steps, and Kane re-verified the whole suite: **6 flows,
21 steps, 0 credits**. Along the way Kane also caught a wrong *assertion* (my
gift-wrap total said `$21.99`; the correct sum is `$22.49`) and classified it as
`automation_bug / config_issue` — not an app defect — which is exactly the kind
of honest separation the loop is for.

## Quick start

Prerequisites: Node 22+, pnpm 9+, Google Chrome, and a Kane CLI login
(`kane-cli login` — never put a key in a file or in chat).

```powershell
pnpm --dir apps/store install
pnpm --dir apps/board install

pnpm dev                          # store on http://localhost:5173
pnpm --dir apps/board dev         # board on http://localhost:5174
pnpm test                         # 51 plugin tests, no browser, no credits
```

Run the store ratchet (replay only — a miss fails instead of re-authoring):

```powershell
pnpm flows:ratchet
```

Run the board's own flow:

```powershell
pnpm flows:board
```

## Use the loop

Inside an OpenCode session in this repo, call the `greenlight_verify` tool after
changing app code. Or let the plugin trigger on the end of a turn that edited
`apps/store/src/**` / `apps/board/src/**`.

- **Green** → a Loop Receipt in `.greenlight/receipts/` (committed), evidence
  pack path, and the run stops.
- **Red** → the same session receives the Failure Brief: failing flow, step,
  screenshot, what Kane actually saw, the bug verdict, and the evidence pack.
  The agent fixes the app and calls the tool again.
- **Integrity blocked** → the agent changed a protected file (flows, recordings,
  config, plugin). Kane is not run, no credits are spent.

## What is committed

- `flows/store/` + `flows/board/` — hand-written multi-step `_test.md` flows and
  their `output-<stem>/` recordings, so replays are free and reproducible.
- `.greenlight/receipts/` — every Loop Receipt (JSON + Markdown + `index.ndjson`).
- `tests/fixtures/kane/` — verbatim Kane streams from real runs; the parser
  tests run against them, not against hand-written mocks.
- `fixtures/recorded/phase2-loop.json` — the recorded red→green story the board
  replays, rebuilt from the real receipts and streams by
  `node scripts/record-replay.mjs`.
- `docs/` — `KANE_NOTES.md` (verified Kane behavior + discrepancies),
  `PLUGIN.md`, `FLOWS.md`, and Phase 0/1 raw evidence.

Not committed: `.testmuai/` (evidence packs, sessions) and
`.greenlight/live.ndjson` / `.greenlight/runs/` (runtime data). Receipts are the
durable record; the raw run NDJSON next to them can be re-parsed without a run.

## The Loop Board

`http://localhost:5174` has two views:

- **Live** — polls `.greenlight/live.ndjson`, shows the loop status, the receipt
  list, the selected receipt's attempts/members/verdict/evidence, and the event
  tail.
- **Replay** — plays `fixtures/recorded/phase2-loop.json` (labelled
  **RECORDED**): the real red run, the verdict card, the fix, and the green
  14/14 replay. No browser, no credits, no network.

## Honest limitations

- Kane's replay analyzers are occasionally flaky (`action_failed: wait @ …`,
  `analyzer_failed: @ step …`) even when the failure screenshot shows the right
  page. The loop reports the screenshot + verdict and does not retry on its own;
  re-run before treating a single red replay as an app bug. See
  `docs/KANE_NOTES.md`.
- The integrity baseline is in-memory per plugin session; a plugin reload
  re-baselines. Receipts still record what changed during a loop.
- The board reads files; there is no database or websocket.

## License

MIT (see `LICENSE`).
