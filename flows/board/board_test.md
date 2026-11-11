---
mode: testing
tags: [board, smoke]
---

# Loop Board

## Open the board
Go to http://localhost:5174 and verify the heading "Loop Board" is visible and the text "Loop receipts" is visible.

## See real receipts
Verify the Loop receipts list shows a GREEN receipt and a RED receipt, and the text "Live tail" is visible.

## Open the green receipt
Click the GREEN receipt that mentions "promo discount" and verify the text "promo_test.md passed" is visible.

## Replay the recorded loop
Click the Replay tab, click the Play button and verify the verdict "Confirmation total omits applied promo discount" is visible.
