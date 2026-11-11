# Kane fixtures — recorded, not synthesized

These files are **verbatim copies** of Kane CLI output from real runs on this
repo (see `docs/evidence/README.md`, `docs/KANE_NOTES.md` and the matching Loop
Receipts in `.greenlight/receipts/`). They are committed so the plugin's parser
can be tested against the real stream shape without spending credits.

| File | Origin | What it proves |
|---|---|---|
| `member-red-cart-2026-11-06.ndjson` | `~/.testmuai/kaneai/sessions/7520dabd-65cf-4c4f-b141-bf22dd433f09/events.ndjson` (the failing `cart_test.md` member of the red ratchet run `09491f13-8018-4ba5-a021-14ca9fc6b746`) | a real step failure: `test_md_step_end` step 4 failed, `run_end.reason = "action_failed: click @ step 1"`, plus the variables Kane captured |
| `member-green-cart-2026-11-06.ndjson` | `…/sessions/7b8b8860-57a6-4217-9e34-e4217136a103/events.ndjson` (the passing `cart_test.md` member of ratchet run `f304dda6-cd21-4eb5-a21c-344c0df82575`) | a clean 4-step replay: `replay_decisions: 4`, `author_decisions: 0` |
| `phase2-testrun-2026-11-07.ndjson` | `…/sessions/testrun-9b29d7db-fd64-442e-947f-93b7b82eb7e4/events.ndjson` (the red plugin run `e1133c75-…`) | 3 replayed flows + 1 **authored** flow in one stream: `testrun_authored_member_start/end` beside `testrun_member_end`, `coverage.pack`, no credits anywhere |
| `phase2-member-cart-2026-11-07.ndjson` | `…/sessions/97ff538a-…/events.ndjson` | a 4-step replay with `credits_consumed: 0` |
| `phase2-member-catalog-2026-11-07.ndjson` | `…/sessions/4ac6ccb9-…/events.ndjson` | a 4-step replay with `credits_consumed: 0` |
| `phase2-member-checkout-2026-11-07.ndjson` | `…/sessions/35e83811-…/events.ndjson` | a 3-step replay with `credits_consumed: 0` |
| `phase2-member-promo-2026-11-07.ndjson` | `…/sessions/0b4b8d74-9fdf-4afb-912d-a5ab5dd1cf10/events.ndjson` (the authored `promo_test.md` member) | 3 authored steps, the real bug verdict (`application_issue / ui_data_defect / major`, confidence 0.98), and the true credit total: 3 × `run_end.credits_consumed` + the verdict call = **71.3240225** |
| `phase2-green-suite-2026-11-10.ndjson` | `.greenlight/runs/2026-11-10T13-04-45Z-6wAPNK7Y-a1.ndjson` (the plugin's green suite run `ffbc6251-…`) | a 4-flow, 14-step replay-only suite: `authored: 0`, `credits_consumed: 0`, `coverage.pack` present. `scripts/record-replay.mjs` reads it to build the board's recorded replay, so that script now works from committed files only. |

Do not edit these by hand. They are evidence, not test input to be tuned.
