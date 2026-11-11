---
mode: testing
tags: [store, giftwrap]
---

# Gift wrap

## Start with a plain order
Go to http://localhost:5173, add the Meridian Notebook to the cart, click the Cart button and verify the cart shows "Total: $18.49" and the checkbox "Add gift wrap (+$4.00)".

## Add gift wrap
Check the "Add gift wrap (+$4.00)" checkbox and verify the cart shows "Gift wrap: $4.00" and "Total: $22.49".

## Pay for the wrapped order
Click Checkout, fill in Full name with "Ada Lovelace", Email with "ada@example.com", Address with "12 Analytical Way", City with "London" and Postal code with "N1 9GU", then click Place order and verify the confirmation page shows "Gift wrap included" and "Total paid: $22.49".
