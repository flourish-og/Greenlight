---
test: ../board_test.md
status: passed
started: 2026-11-10T13:39:43.885Z
duration_s: 135
session_id: 6029a36e-06e9-4a9c-aabb-a5cec62d4bd6
---

# Loop Board — Result

## Open the board ✓ passed (1.81s)
md5: f21d7eada4ffcdb6e8f421c0e4ab7921
Go to http://localhost:5174 and verify the heading "Loop Board" is visible and the text "Loop receipts" is visible.

## See real receipts ✓ passed (0.64s)
md5: 2b9b9569e62b70d1767da0f2bee3dbf3
Verify the Loop receipts list shows a GREEN receipt and a RED receipt, and the text "Live tail" is visible.

## Open the green receipt ✓ passed (58.5s)
md5: 0ab1c0d7c64005ed117eca3f5756526d
Click the GREEN receipt that mentions "promo discount" and verify the text "promo_test.md passed" is visible.

## Replay the recorded loop ✓ passed (60.6s)
md5: d75b833ba0291b525f673653feffd5fc
Click the Replay tab, click the Play button and verify the verdict "Confirmation total omits applied promo discount" is visible.
