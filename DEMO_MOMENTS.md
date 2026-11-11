# DEMO MOMENTS

Every notable real event, for the demo video. Log: timestamp, run id, evidence
path, and what happened.

Format:

```
- <ISO timestamp> · run <id> · evidence <path>
  What happened (red run / regression caught / fix).
```

- **2026-11-06T22:53:29Z** · `testmd run flows/store/catalog_test.md` · session
  `c184c8a6-bdd9-4b65-a33b-d5045b05ef61`
  **First real red run.** Kane selected the Lighting filter, then failed step 2
  because the count read `Showing 3 of 6 products` and our step demanded
  `3 of 3`. It did not fail silently: `run_end` carried
  `result_code: 740`, `reason_code: assertion_error.confirmed_product_bug`, and
  a full `verdict` (`bug_title: "Lighting filter leaves all products visible"`,
  `severity: major`, `confidence: 0.98`, `culprit_step: 1-1`). Investigation
  showed the expectation was ours, not the app's: the count is intentionally
  `Showing <filtered> of <total>`. Fixed the step wording; the replay passed.
  Lesson for the loop: the Failure Brief must show the verdict and the
  screenshot, and the agent must be allowed to conclude "test wrong" instead of
  patching the app.

- **2026-11-06T23:00:20Z** · `testmd run flows/store/catalog_test.md` · session
  `abe85a09-b2e1-4d22-8ea0-6741259c1c06`
  **Planner stall, not a product bug.** After clearing a search field, the agent
  could not act for three steps (`AP produced no action for 3 consecutive
  steps`) and the run exited 1. Rewrote only step 4 to navigate fresh before
  typing, which made the step self-contained. Replay cost nothing for steps 1-3.

- **2026-11-06T23:04:18Z** · `testmd run flows/store/cart_test.md` (4 steps) ·
  session `ee0ccac6-fa90-4ac2-9bc4-1e7a4b52a011`
  **First fully authored flow.** 4/4 steps passed in 208 s with
  `replay_decisions: 0, author_decisions: 4`. The trailing `test_md_summary`
  event is the exact signal the Loop Board will use to show "authored vs
  replayed". Cart maths verified by Kane itself: $54.50 -> $96.50 -> $84.00.

- **2026-11-06T23:16:09Z** · `testrun run --no-adaptive-heal` (execution
  `09491f13-8018-4ba5-a021-14ca9fc6b746`) · failing member
  `flows/store/cart_test.md`, session `7520dabd-65cf-4c4f-b141-bf22dd433f09`
  **The ratchet caught a real regression, loudly.** 2/3 tests passed; cart step 4
  failed with `{"message":"action_failed: click @ step 1","step_index":4}`.
  Root cause: the recording for "Remove on the Meridian Notebook row" had
  `selectors: null` and a vision point `{x:1282,y:336}` - two buttons are named
  "Remove", so the DOM resolver gave up and clicked pixels. With
  `--no-adaptive-heal` it refused to re-author and just failed, which is exactly
  the ratchet behaviour we want. Fixed the app, not the test: unique
  `aria-label`s on every Add-to-cart and Remove control.

- **2026-11-06T23:39:01Z** and **2026-11-06T23:40:55Z** · `testrun run
  --no-adaptive-heal` · executions `f304dda6-…` and `92fa5988-…`
  **Two consecutive clean ratchet runs.** 3/3 tests, 11/11 steps,
  `authored: 0`, all steps `replay_decisions`, 131 s then 99 s, 1.67 then 0.71
  credits for the whole suite. Every recorded click/fill now resolves through a
  role/testid selector; no vision coordinates remain in the store flows. This is
  the Phase 1 gate evidence.

- **2026-11-07T00:07:52Z** · `greenlight_verify` (plugin tool) · execution
  `e1133c75-9167-41da-a121-088e0cbdb827` · evidence
  `.testmuai/evidence/e1133c75-9167-41da-a121-088e0cbdb827.evidence`
  **The loop caught a real money bug on its first run.** After the agent added
  promo codes, the plugin ran the 4-flow suite. Kane authored the 3 promo steps,
  saw `Total: $37.80` in the cart and checkout, then failed the confirmation
  assertion: `The order confirmation charged $42.00 even though the checkout
  total was $37.80.` Verdict: `application_issue / ui_data_defect / major`,
  confidence 0.98, bug title *Confirmation total omits applied promo discount*,
  culprit step `2-12`. The app computed the discount for display but
  `placeOrder` still stored `subtotalCents`. Kane caught it because the flow
  asserted the **outcome** (paid total), not the button.

- **2026-11-07T03:29Z and 03:39Z** · `greenlight_verify` retries · executions
  `634ca733-…` and `a17e42e3-…`
  **Replay flakiness, recorded honestly.** The first retry failed
  `catalog_test.md` step 4 on a `wait` (`action_failed: wait @ step 4`) while
  its own failure screenshot showed the correct product page; the flow passed
  standalone minutes later. The second retry failed `promo_test.md` step 2 with
  `analyzer_failed: @ step 5` (a tool error, not a failed assertion) on a pure
  replay costing 0 credits. Lesson for the board: show the screenshot and the
  verdict, and do not treat a single replay miss as an app bug.

- **2026-11-10T13:00:05Z** · `greenlight_verify` · execution
  `ffbc6251-5912-413e-90de-c2b9f105ea3e` · receipt
  `.greenlight/receipts/2026-11-10T13-00-05Z-6wAPNK7Y.json`
  **Green: 14/14 checks, 4/4 flows, 0 credits, 279.7 s.** The promo flow now
  replays every step (`authored: 0`, `replayed: 14`) and the confirmation page
  pays `$37.80`. The receipt records the raw NDJSON
  (`.greenlight/runs/2026-11-10T13-04-45Z-6wAPNK7Y-a1.ndjson`), the step
  totals, and the evidence pack, so the whole red→green story can be replayed
  without spending a credit.

- **2026-11-10T18:17–18:38Z** · `testmd run` (feature authoring) · session
  `02b5b6c4-880a-4d5c-a668-d26c19416b75` · evidence
  `.testmuai/evidence/7b4e1108-7952-4cff-a73d-ad3bc8c234c7.evidence`
  **Kane corrected a test expectation, and classified it honestly.** While
  authoring the gift-wrap flow, Kane failed step 2 and reported
  `automation_bug / config_issue` (severity `minor`, confidence 0.97) — *not* an
  app bug. The app was right: `$12.50 + $5.99 shipping + $4.00 gift wrap =
  $22.49`, but my step asserted `$21.99`. Kane's one-liner even said "Update the
  test expectation to $22.49". A useful reminder that the loop flags bad
  assertions too, and labels them differently from app defects.

- **2026-11-10T18:39:47Z** · `greenlight_verify` · execution
  `238b4a03-f533-4c16-8ddd-bd6227e1c5cc` · receipt
  `.greenlight/receipts/2026-11-10T18-39-47Z-59APNK7Y.json`
  **Green: 21/21 checks, 6/6 flows, 0 credits, 471.2 s.** The two new features
  (free shipping over $75, gift wrap) are in, and the suite now covers 6 flows.
  Everything replays (`authored: 0`, `replayed: 21`): cart, catalog, checkout
  ($29.99 with shipping), promo ($43.79 with shipping), shipping (paid → free
  across the $75 threshold), and gift wrap ($22.49).
