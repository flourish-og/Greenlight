---
mode: testing
tags: [store, shipping]
---

# Shipping and the free-shipping threshold

## Pay flat-rate shipping
Go to http://localhost:5173, add the Meridian Notebook to the cart, click the Cart button and verify the cart shows "Shipping: $5.99" and "Total: $18.49".

## Cross the free-shipping threshold
Click Shop, add the Nimbus Floor Lamp to the cart, click the Cart button and verify the cart shows "Shipping: Free" and "Total: $101.50".

## Check out with free shipping
Click Checkout and verify the checkout page shows an order total of $101.50.

## Pay the total with free shipping
Fill in Full name with "Ada Lovelace", Email with "ada@example.com", Address with "12 Analytical Way", City with "London" and Postal code with "N1 9GU", then click Place order and verify the confirmation page shows "Total paid: $101.50".
