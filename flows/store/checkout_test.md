---
mode: testing
tags: [store, checkout]
---

# Checkout and confirmation

## Start checkout
Go to http://localhost:5173, add the Halo Task Light to the cart, click the Cart button, click Checkout and verify the checkout page shows the heading "Checkout" and an order total of $29.99.

## Reject an empty form
Click Place order without filling in any field and verify the error message "Full name is required" is visible.

## Place the order
Fill in Full name with "Ada Lovelace", Email with "ada@example.com", Address with "12 Analytical Way", City with "London" and Postal code with "N1 9GU", then click Place order and verify the confirmation page shows "Order confirmed", "Thank you, Ada Lovelace." and an order number that starts with GL-.
