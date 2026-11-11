---
mode: testing
tags: [store, promo]
---

# Promo codes

## Reject an unknown promo code
Go to http://localhost:5173, add the Aurora Desk Lamp to the cart, click the Cart button, type "NOPE" into the Promo code field, click the Apply promo code button and verify the error message "That promo code is not valid" is visible.

## Apply a real promo code
Type "GREENLIGHT10" into the Promo code field, click the Apply promo code button and verify the message "Promo code GREENLIGHT10 applied" is visible and the cart shows "Total: $43.79".

## Pay the discounted total
Click Checkout, fill in Full name with "Ada Lovelace", Email with "ada@example.com", Address with "12 Analytical Way", City with "London" and Postal code with "N1 9GU", then click Place order and verify the confirmation page shows "Total paid: $43.79".
