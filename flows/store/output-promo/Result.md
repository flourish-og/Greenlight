---
test: ../promo_test.md
status: passed
started: 2026-11-10T18:02:08.590Z
duration_s: 336
session_id: 2fd19137-16f9-47c4-80ce-82a1a5fe833b
---

# Promo codes — Result

## Reject an unknown promo code ✓ passed (5.78s)
md5: a2f4bca223a50abf84cc83f1ce74f1f2
Go to http://localhost:5173, add the Aurora Desk Lamp to the cart, click the Cart button, type "NOPE" into the Promo code field, click the Apply promo code button and verify the error message "That promo code is not valid" is visible.

## Apply a real promo code ✓ passed (168.8s)
md5: a70529087cc8906ff052d8618662b2f8
Type "GREENLIGHT10" into the Promo code field, click the Apply promo code button and verify the message "Promo code GREENLIGHT10 applied" is visible and the cart shows "Total: $43.79".

## Pay the discounted total ✓ passed (132.2s)
md5: 3a39c556f9c6393637a169451fdffe52
Click Checkout, fill in Full name with "Ada Lovelace", Email with "ada@example.com", Address with "12 Analytical Way", City with "London" and Postal code with "N1 9GU", then click Place order and verify the confirmation page shows "Total paid: $43.79".
