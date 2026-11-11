---
test: ../checkout_test.md
status: passed
started: 2026-11-10T14:00:30.591Z
duration_s: 501
session_id: 1f059a31-d593-4139-9cd0-de2cb6b59d6e
---

# Checkout and confirmation — Result

## Start checkout ✓ passed (152.6s)
md5: 7803d2a967f90838e6ca208cc0ec1a80
Go to http://localhost:5173, add the Halo Task Light to the cart, click the Cart button, click Checkout and verify the checkout page shows the heading "Checkout" and an order total of $29.99.

## Reject an empty form ✓ passed (86.9s)
md5: 8f387b202d5195c21980e041863d22fd
Click Place order without filling in any field and verify the error message "Full name is required" is visible.

## Place the order ✓ passed (242.7s)
md5: 936901767253c28a2521b91f805d715e
Fill in Full name with "Ada Lovelace", Email with "ada@example.com", Address with "12 Analytical Way", City with "London" and Postal code with "N1 9GU", then click Place order and verify the confirmation page shows "Order confirmed", "Thank you, Ada Lovelace." and an order number that starts with GL-.
