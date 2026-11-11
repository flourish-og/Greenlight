# Flows

Kane CLI tests live in `flows/`. Every file ends in `_test.md`; each `##`
heading is one step, authored and recorded once, then replayed from
`output-<stem>/`.

## Run the suite

The dev server must be up first (`pnpm dev`, http://localhost:5173):

```powershell
pnpm flows            # authoring allowed (default)
pnpm flows:ratchet    # replay only - a miss fails instead of re-authoring
```

Both wrap:

```powershell
kane-cli testrun run --match "^flows[/\\]store[/\\]" --agent --headless --no-adaptive-heal
```

`testrun run` has no `--timeout`; give the host shell 10 minutes.

## Replay economics

A step replays (no LLM credits) only when its recording exists and the step text
is unchanged. Editing step N re-authors step N and every step after it. Keep the
`output-<stem>/` folders in git or every run pays to author again.

The trailing `test_md_summary` event tells you which happened:
`steps.author_decisions` vs `steps.replay_decisions`.

## Store flows

| File | Steps | What it proves |
|---|---|---|
| `store/catalog_test.md` | 4 | 6 products render, category filter narrows the list, search finds one product, detail page shows its price |
| `store/cart_test.md` | 4 | two products add up ($54.50), quantity +1 ($96.50), remove a line ($84.00) |
| `store/checkout_test.md` | 3 | checkout opens with the right total, an empty form is rejected with an inline error, a filled form produces an order number |
| `store/promo_test.md` | 3 | an invalid code is rejected, `GREENLIGHT10` discounts the cart to $37.80 before shipping, and the confirmation pays the discounted total plus shipping |
| `store/shipping_test.md` | 4 | a $12.50 order pays $5.99 shipping ($18.49), adding the $89.00 lamp crosses $75 so shipping is free ($101.50), and the confirmation pays $101.50 |
| `store/giftwrap_test.md` | 3 | the plain order is $18.49, checking gift wrap adds $4.00 ($21.99), and the confirmation keeps both the gift-wrap note and the paid total |

## Board flows

The board runs on http://localhost:5174 (`pnpm --dir apps/board dev`). Its flow
is not part of the store ratchet (the plugin's `flows.match` stays store-only):

```powershell
kane-cli testrun run --match "^flows[/\\]board[/\\]" --agent --headless --no-adaptive-heal
```

| File | Steps | What it proves |
|---|---|---|
| `board/board_test.md` | 4 | the board renders, lists the real GREEN/RED receipts, opens the green receipt, and replays the recorded verdict |

Line endings matter: `_test.md` files are stored as LF (see `.gitattributes`)
because the recording is keyed by an md5 of the step text.
