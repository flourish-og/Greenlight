# PROGRESS

Live status of the build. Updated at the end of every phase.

## Phase 0 — Learn & verify (done)

- [x] `git init` (fresh repo at `C:\Users\flour\Desktop\greenlight`).
- [x] Read Kane docs: `llms.txt` (agent index), `AGENTS.md`, `docs/llms.txt`
  (index), agent-mode, testmd-running, testrun, evidence-pack-structure,
  evidence-debugging, CLI reference.
- [x] Prereqs verified: Node v22.23.2, Chrome installed, pnpm 9.15.9.
- [x] Install `kane-cli` → `@testmuai/kane-cli@0.10.2` (global).
- [x] `kane-cli --version` (0.10.2), `whoami` (not logged in), `balance` (not
  authenticated). Confirmed `testrun run` has NO `--timeout` flag; found
  `--stream-members` for per-flow detail. → recorded in KANE_NOTES.
- [x] **Smoke test** — PASSED 2026-11-06. Exit 0, `status: passed`,
  `duration 28.3 s`, `credits_consumed 11.278525`,
  `final_state {url, page_heading: "Example Domain"}`, `test_url` present.
  Raw NDJSON: `docs/evidence/phase0-smoke-run-2026-11-06.ndjson`.
  Evidence pack: 21-entry zip, documented layout (screenshots are `.jpg`).
- [x] `docs/KANE_NOTES.md` — doc-derived + empirical (CLI flags, plugin API).
- [x] OpenCode plugin probe (throwaway) — logs `tool.execute.after`,
  `session.execution.*`, idle candidates to `.greenlight/debug.log`.
  Proved `ctx.session.prompt` re-prompt in ~5 ms (no deadlock) and found the
  real turn-end signal: **`session.execution.succeeded`** (`session.idle` event
  and `experimental.idle` hook never fire in 2.1.4).
- [x] `AGENTS.md` (repo root).

## GATE (Phase 0) — ready

Evidence: smoke-run `run_end` (below), `docs/KANE_NOTES.md`, probe log
`.greenlight/debug.log`.

## Phase 1 — Storefront + baseline flows (done)

- [x] `apps/store` — Vite 5 + React 18 + TypeScript, deterministic (no backend,
  no network, no random). 6 products, category filter, search, detail view,
  cart with quantity steppers, checkout with custom validation, deterministic
  `GL-1001`+ order numbers. `tsc -b` and `vite build` clean.
- [x] Controls carry unique accessible names (`Add <product> to cart`,
  `Remove <product>`, `Increase/Decrease quantity for <product>`,
  `data-testid="cart-button"`), so recordings bind to role/testid selectors
  instead of vision coordinates. Measured reason: two "Remove" buttons made the
  resolver fall back to `{x:1282,y:336}` and the ratchet caught the miss.
- [x] Three hand-written multi-step flows under `flows/store/`, each authored
  against the real app and committed with its `output-<stem>/` recording:
  - `catalog_test.md` — 4 steps, 4/4 replayed.
  - `cart_test.md` — 4 steps, 4/4 replayed.
  - `checkout_test.md` — 3 steps, 3/3 replayed (order `GL-1001` captured).
- [x] `pnpm flows` / `pnpm flows:ratchet` wrap
  `kane-cli testrun run --match "^flows[/\\]store[/\\]" --agent --headless
  [--no-adaptive-heal]`.
- [x] `.gitattributes` stores text as LF: recordings are keyed by an md5 of the
  step text, so a CRLF rewrite would force paid re-authoring.
- [x] Two consecutive clean ratchet runs:
  `3/3 tests, 11/11 steps, authored: 0` — 131 s / 1.67 credits, then
  99 s / 0.71 credits. Available balance after Phase 1: **10,812.20 credits**
  (`kane-cli balance`).

## GATE (Phase 1) — ready

Evidence: `testrun_summary` from executions `f304dda6-cd21-4eb5-a21c-344c0df82575`
and `92fa5988-1921-4edf-b52b-a8748bd81968` (raw NDJSON in
`.greenlight/testrun-3.ndjson`, `.greenlight/testrun-4.ndjson`), committed
recordings in `flows/store/output-{catalog,cart,checkout}/`, and
`DEMO_MOMENTS.md` entries for the red run and the selector fix.

## Phase 2 — Plugin v1 (done)

- [x] Directory plugin `.opencode/plugins/greenlight/` (`index`, `config`,
  `glob`, `integrity`, `kane`, `loop`, `receipt`) + `greenlight.config.json`.
  **50 unit tests** (`node --test`, Node 22 type stripping) against real
  recorded Kane streams in `tests/fixtures/kane/`.
- [x] Triggers: explicit `greenlight_verify` tool + automatic
  `session.execution.succeeded` when an app file changed. Runs are serialized;
  red with no app edit is not re-run.
- [x] Integrity guard: snapshots `flows/**/*_test.md`, the config, the package
  files and the plugin; a change blocks the run **before** Kane and writes an
  `integrity_blocked` receipt (0 credits).
- [x] Credit + iteration budget in `decide()`; Failure Brief built from the real
  verdict, failing step, screenshot, observed values and evidence pack.
- [x] Loop Receipts (JSON + Markdown + `index.ndjson`) and raw NDJSON under
  `.greenlight/runs/` (gitignored; receipts are committed).
- [x] Promo feature built through the loop: `PROMO_CODES = { GREENLIGHT10: 10 }`,
  promo input/button, invalid-code error, discount line, discounted total.
- [x] **Real red:** Kane authored the 3-step promo flow and caught a money bug —
  the cart/checkout showed `Total: $37.80` but the confirmation charged
  `$42.00`. Verdict `application_issue / ui_data_defect / major`, confidence
  0.98, bug title *Confirmation total omits applied promo discount*. The app
  stored `subtotalCents` in `placeOrder`; fixed to `totalCents`.
- [x] **Real green:** `testrun run` replayed 14/14 steps in 279.7 s for
  **0 credits** (`authored: 0`), evidence `ffbc6251-…`, receipt
  `.greenlight/receipts/2026-11-10T13-00-05Z-6wAPNK7Y.json`.
- [x] Recordings committed for all 4 store flows (`output-<stem>/`), including
  `output-promo/` authored by the red run.

## GATE (Phase 2) — ready

Evidence: receipts `2026-11-07T00-07-52Z-hqAPNK7Y` (money-bug red),
`2026-11-10T13-00-05Z-6wAPNK7Y` (green 14/14, 0 credits); evidence packs
`e1133c75-…` and `ffbc6251-…`; 50 plugin tests; `docs/PLUGIN.md`.

> Honesty note: the 00:07 red receipt was originally written by the pre-fix
> parser, which dropped the authored promo flow, the verdict, and the credit
> total (it showed `11/11 steps, 0 credits`). The real run was 14 steps
> (13 passed, 1 failed) and 71.32 credits, recovered from the member logs now
> committed in `tests/fixtures/kane/phase2-*` and asserted by `kane.test.ts`.
> The receipt has since been **regenerated** by `scripts/backfill-red-receipt.mjs`,
> which runs the current parser over those same committed fixtures, so the board
> now shows the real verdict (`application_issue / ui_data_defect / major`,
> confidence 0.98) and the true totals.

## Phase 3 — Loop Board (done)

- [x] `apps/board` — Vite 5 + React 18 + TypeScript, no database and no
  websocket. `server/api.mjs` is a zero-dependency read-only API over files the
  plugin already writes (`/api/live`, `/api/receipts`, `/api/receipts/<file>`,
  `/api/replay`, `/api/health`); the same handler is mounted as Vite middleware
  in dev and served by `server/start.mjs` in production. (Deviation from the
  plan's Hono, logged: one fewer dependency, same routes.)
- [x] **Live tab** — loop status, receipt list, the selected receipt's attempts,
  members, step totals, verdict card, evidence and raw-stream paths, and a
  polling tail of `.greenlight/live.ndjson`.
- [x] **Replay tab** — plays `fixtures/recorded/phase2-loop.json`, which
  `scripts/record-replay.mjs` builds from the committed receipts and verbatim
  Kane streams (23 entries, provenance + sha256 in the file). The UI labels it
  **RECORDED**; it needs no browser and spends no credits.
- [x] `flows/board/board_test.md` — 4 steps authored against the running board
  (455 s, 4/4 passed) and then replayed green (`1/1 flows`, 68 s, 0 authored).
  Step 3 was reworded after a reproducible `analyzer_failed: @ step 3` on a
  condition containing a URL; the final flow asserts the receipt text instead.
- [x] `pnpm board`, `pnpm build`, `pnpm flows:board`, `pnpm replay:record`; both
  apps build clean.

## GATE (Phase 3) — ready

Evidence: `flows/board/output-board/` (`meta.json` author + replay executions,
`valid: true`), replay execution `6a0202c5-17e6-49b2-861a-c03023f70daa`,
`fixtures/recorded/phase2-loop.json`, and the board's own API responding on
http://localhost:5174.

## Phase 5 — Features through the loop (done)

- [x] **Promo codes** (Phase 2) — caught the real money bug described above.
- [x] **Free shipping over $75** — flat `$5.99` under the threshold, free at or
  above it, computed on the discounted subtotal. New `shipping_test.md`.
- [x] **Gift wrap (+$4.00)** — a cart checkbox, a line in the cart and checkout,
  and a "Gift wrap included" note on the confirmation. Gift wrap never counts
  toward the free-shipping threshold. New `giftwrap_test.md`.
- [x] The shipping change moved the totals that `checkout_test.md` and
  `promo_test.md` asserted, so those steps were updated and re-authored, and the
  whole suite re-verified.

## Phase 6 — Freeze (done)

- [x] `SUBMISSION.md` (one-paragraph entry + links + run commands), `README.md`
  headline updated to the 6-flow / 21-step green, `DEMO_SCRIPT.md` and
  `DEMO_MOMENTS.md` cover the new beats.
- [x] **Clean-clone verify** (fresh `git clone` → install → test → build →
  replay): 51/51 plugin tests, `apps/store` and `apps/board` both build clean,
  and `node scripts/record-replay.mjs` regenerates the 23-entry recorded replay
  from committed files only (the green stream's sha256 matches the original run).
- [x] Board replay made reproducible: the green suite stream is committed as
  `tests/fixtures/kane/phase2-green-suite-2026-11-10.ndjson`; `record-replay.mjs`
  no longer reads the gitignored `.greenlight/runs/` path.

## GATE (Phase 6) — ready

Evidence: clean-clone verify above, `SUBMISSION.md`, receipts
`2026-11-07T00-07-52Z` (red), `2026-11-10T13-00-05Z` (14/14 green),
`2026-11-10T18-39-47Z` (21/21 green).

## Findings recorded (rule 6)

- OpenCode is v2 (2.1.4): `@opencode/plugin` (not `@opencode-ai/plugin`),
  `filesystem.changed` (not `file.edited`), `ctx.session.prompt` (not
  `client.session.prompt`).
- `ctx.event.subscribe` `types` filter is not applied at runtime; filter manually.
- `filesystem.changed` does not fire for tool/external writes; use
  `tool.execute.after` + `input.path` to track edits.
- The `session.idle` **event** and the `experimental.idle` **session hook** both
  never fire on Desktop 2.1.4; the working turn-end signal is
  `session.execution.succeeded` / `.failed` / `.interrupted`.
- `testrun run` has no `--timeout`; drop it from the ratchet command.
- `testrun run` prints no credits at all: sum each member's
  `run_end.credits_consumed` (+ `run_end.verdict.credits_consumed`). Authored
  flows emit `testrun_authored_member_start/end`, not `testrun_member_end`, and
  are absent from `testrun_start.members` — a parser must handle both.
- `--match` is an unanchored regex: `catalog_test` also matched the published
  copy under `.testmuai/tests/`. Anchor the store suite with
  `^flows[/\\]store[/\\]`.
- Replay analyzers are occasionally flaky (`action_failed: wait @ …`,
  `analyzer_failed: @ step …`) with the correct screenshot on disk. Re-run
  before calling it an app bug; the receipt keeps the raw stream either way.
