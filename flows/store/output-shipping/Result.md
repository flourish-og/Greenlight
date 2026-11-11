---
test: ../shipping_test.md
status: passed
started: 2026-11-10T18:09:07.667Z
duration_s: 381
session_id: 125bb51e-926f-4840-9ac5-101824335fb0
---

# Shipping and the free-shipping threshold — Result

## Pay flat-rate shipping ✓ passed (65.1s)
md5: 9e86ea659068283e2303497b9a2629f9
Go to http://localhost:5173, add the Meridian Notebook to the cart, click the Cart button and verify the cart shows "Shipping: $5.99" and "Total: $18.49".

## Cross the free-shipping threshold ✓ passed (125.3s)
md5: 146c4602dc7f26e8f05c01425e3d1a85
Click Shop, add the Nimbus Floor Lamp to the cart, click the Cart button and verify the cart shows "Shipping: Free" and "Total: $101.50".

## Check out with free shipping ✓ passed (57s)
md5: a0c48a9f9111024d7ba434980e778531
Click Checkout and verify the checkout page shows an order total of $101.50.

## Pay the total with free shipping ✓ passed (118.4s)
md5: 7da5fe96cfcb965b2b3c0dabffd8239c
Fill in Full name with "Ada Lovelace", Email with "ada@example.com", Address with "12 Analytical Way", City with "London" and Postal code with "N1 9GU", then click Place order and verify the confirmation page shows "Total paid: $101.50".
