# DEMO SCRIPT

Target: 3–4 minutes. Everything below is real; no staged passes.

## 0. Before recording (5 min)

```powershell
pnpm --dir apps/store install
pnpm --dir apps/board install
pnpm dev                          # store, port 5173
pnpm --dir apps/board dev         # board, port 5174
pnpm test                         # 51 tests, green
```

Open:
- http://localhost:5173 (store)
- http://localhost:5174 (board)
- `README.md`, `.greenlight/receipts/` and `.opencode/plugins/greenlight/` in the editor.

## 1. The premise (20 s)

> "Agents can write code faster than anyone can verify it. GREENLIGHT makes the
> verification part of the agent's own loop. The agent changes the app, Kane CLI
> tests it in a real browser, and a red result goes back to the same agent with
> a bug report it has to fix — not a test it can edit."

Show the three parts in the README table: plugin, board, storefront.

## 2. The money bug (60 s)

On the **board**, Live tab:

- Point at the four receipts. The oldest is **RED** at 00:07.
- Click it. Read the attempt card and the Kane verdict:
  - `application_issue / ui_data_defect / major`, confidence 0.98
  - **Confirmation total omits applied promo discount**
  - "The order confirmation charged $42.00 even though the checkout total was
    $37.80."
- Point at the failing flow `promo_test.md` step 3, and the evidence path.
- Say what happened: the agent added promo codes and applied the discount in the
  cart and checkout, but `placeOrder` still stored `subtotalCents`.

Show the fix in `apps/store/src/App.tsx`:

```diff
- setOrder({ number, name: fields.name.trim(), totalCents: subtotalCents })
+ setOrder({ number, name: fields.name.trim(), totalCents })
```

## 3. The green run (45 s)

On the board, click the **GREEN** receipt from 2026-11-10:

- 14 passed, 0 failed, **0 authored, 14 replayed, 0 credits, 279.7 s**.
- Four flows: cart, catalog, checkout, promo.
- Raw NDJSON path and evidence pack path.

Say: "Every step replayed from the committed recordings. Kane re-checked the
whole suite for free. That is the ratchet: if anything regresses, the replay
fails loudly instead of silently re-authoring."

## 4. The recorded replay (45 s)

On the board, Replay tab → **Play**:

- The banner says **RECORDED** and names the provenance files.
- Watch the red run: 3 flows replayed, promo authored, verdict card, 71.32
  credits.
- Then the green run: 4 flows replayed, 0 credits.

Say: "This is the actual event stream, not a mock. The board can replay the whole
loop from committed evidence with no browser and no credits."

## 5. The plugin (30 s)

Open `.opencode/plugins/greenlight/index.ts` and `kane.ts`:

- `greenlight_verify` tool + `session.execution.succeeded` auto trigger.
- Integrity guard: flows, recordings, config and plugin are protected; editing
  them voids the run before Kane starts.
- `decide()`: green, red, budget, max iterations.
- Failure Brief: failing flow/step, screenshot, observed values, verdict,
  evidence.
- Receipts: JSON + Markdown + raw NDJSON.

Optional live beat if time allows (≈5 min, 0 credits):

> Call `greenlight_verify` and show the receipt appear on the board's Live tail.

## 6. Close (15 s)

> "GREENLIGHT is three things in one repo: a plugin that makes Kane part of the
> agent loop, a board that makes the loop legible, and a storefront whose promo
> feature was actually caught and fixed by that loop. Nothing shipped until Kane
> said so."

## Backup beats

- `docs/KANE_NOTES.md` — the verified quirks: `testrun run` prints no credits,
  authored flows emit different events, replay analyzers are flaky.
- The gift-wrap authoring catch (2026-11-10T18:17): Kane failed my step with
  `automation_bug / config_issue` because the app was right (`$22.49`) and my
  assertion was wrong (`$21.99`) — a one-screen demo that the loop separates app
  bugs from bad assertions.
- Phase 1 red receipt: the ratchet caught a vision-coordinate regression after a
  layout change, which led to unique accessible names.
- `pnpm test` — 51 parser/receipt tests against real Kane streams.
