---
test: ../cart_test.md
status: passed
started: 2026-11-06T23:27:22.147Z
duration_s: 353
session_id: da1a683b-8291-4c13-bfe9-1967909b5a95
---

# Cart mathematics — Result

## Add two products ✓ passed (138.3s)
md5: 4b9be559657e2bcba924ebc2988cbb6a
Go to http://localhost:5173, add the Aurora Desk Lamp to the cart, then add the Meridian Notebook to the cart and verify the cart button reads "Cart (2)".

## Open the cart ✓ passed (91.8s)
md5: 0f708a84b31ecc20962e994b0073e1f3
Click the Cart button and verify the cart lists the Aurora Desk Lamp and the Meridian Notebook with a subtotal of $54.50.

## Increase a quantity ✓ passed (64.9s)
md5: 067d131618d8581a5c20470e1f60f77f
Click the Increase quantity for Aurora Desk Lamp button and verify the subtotal updates to $96.50.

## Remove a line ✓ passed (37.8s)
md5: 3d512722015fc86b56d508f70a7cba29
Click Remove on the Meridian Notebook row and verify the cart now lists only the Aurora Desk Lamp with a subtotal of $84.00.
