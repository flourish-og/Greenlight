# DEMO VIDEO — 3-minute shot list

Target: **3:00 exactly**, lead with the interesting part. Record screen + mic.
Keep the store on `http://localhost:5173` and the board on `http://localhost:5174`
running in two browser windows (or record the board, then tab to the store).

Before recording (one-time):
```powershell
pnpm dev                          # store :5173
pnpm --dir apps/board dev         # board :5174
```
Open the board at :5174, and have `apps/store/src/App.tsx` ready in the editor.

---

## 0:00–0:20 — Hook (20 s)

> "Coding agents write code faster than anyone can verify it. GREENLIGHT closes
> that loop: the agent changes the app, Kane CLI tests it in a real browser, and
> a red result goes back to the *same* agent to fix. Nothing ships until Kane
> says so."

*On screen:* the board **Replay** tab, press **Play**, let 3–4 entries appear.

## 0:20–0:50 — The money bug (30 s)

Switch to the board **Live** tab. Click the **RED** receipt (00:07).

> "The loop's first real run. After I asked the agent to add promo codes, Kane
> authored the flow and caught a money bug: the cart and checkout said $37.80,
> but the confirmation charged $42.00."

*On screen:* the verdict card —
`application_issue / ui_data_defect / major`, confidence **0.98**,
*"Confirmation total omits applied promo discount"*.

## 0:50–1:20 — The fix + green (30 s)

Switch to the editor, highlight the one-line diff:

```diff
- setOrder({ number, name: fields.name.trim(), totalCents: subtotalCents })
+ setOrder({ number, name: fields.name.trim(), totalCents })
```

> "One line. Then the suite re-verified — 21 steps across 6 flows, for zero
> credits, because every step replays from the committed recordings."

*On screen:* the **GREEN** receipt (18:39) — `21 passed, 0 authored, 0 credits`.

## 1:20–1:50 — The loop itself (30 s)

Open `.opencode/plugins/greenlight/index.ts` and `kane.ts`.

> "The plugin hooks `session.execution.succeeded` — the real end-of-turn signal —
> runs the committed flows, and on a red it builds a Failure Brief from Kane's
> verdict, screenshot and observed values, then re-prompts the same session. An
> integrity guard snapshots the flows and recordings so the agent can't edit a
> test into passing."

*On screen:* point at the `greenlight_verify` tool + the integrity guard + `decide()`.

## 1:50–2:20 — Kane corrects *me* (30 s)

> "It also catches bad assertions, not just bad code. While I was adding gift
> wrap, Kane failed my step and filed `automation_bug / config_issue` — the app
> was right: $12.50 + $5.99 shipping + $4.00 wrap is $22.49, but my test said
> $21.99. Kane told me to fix the test, and it labelled it a test defect, not an
> app bug."

*On screen:* the gift-wrap verdict or the DEMO_MOMENTS entry.

## 2:20–2:50 — Live beat (30 s)

> "Here it is live." Trigger `greenlight_verify` (or show the shell command) and
> watch the receipt appear on the board's Live tail in real time.

*On screen:* board Live tail updates → new GREEN receipt.

## 2:50–3:00 — Close (10 s)

> "GREENLIGHT: a plugin that puts Kane inside the agent loop, a board that makes
> it legible, and a storefront that was actually caught and fixed by that loop.
> Red → agent → green. Nothing ships until Kane says so."

---

## Delivery checklist

- [ ] Recorded at 1920×1080, mic on, no music.
- [ ] Upload to YouTube → **Unlisted** (not Private).
- [ ] Open the link in an **incognito window** to confirm it plays.
- [ ] Repo URL + video URL + paragraph pasted into the form.
