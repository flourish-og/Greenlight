---
test: ../giftwrap_test.md
status: passed
started: 2026-11-10T18:36:09.079Z
duration_s: 154
session_id: 977dce19-ef49-4373-878c-ba70d52e96a7
---

# Gift wrap — Result

## Start with a plain order ✓ passed (3.72s)
md5: 2a8730ac502a76baf387293495707134
Go to http://localhost:5173, add the Meridian Notebook to the cart, click the Cart button and verify the cart shows "Total: $18.49" and the checkbox "Add gift wrap (+$4.00)".

## Add gift wrap ✓ passed (37.1s)
md5: b887623c0350c36bad21b3e372e54d44
Check the "Add gift wrap (+$4.00)" checkbox and verify the cart shows "Gift wrap: $4.00" and "Total: $22.49".

## Pay for the wrapped order ✓ passed (86.4s)
md5: 5d2fcc4ccad39053260d7460f05b1ef8
Click Checkout, fill in Full name with "Ada Lovelace", Email with "ada@example.com", Address with "12 Analytical Way", City with "London" and Postal code with "N1 9GU", then click Place order and verify the confirmation page shows "Gift wrap included" and "Total paid: $22.49".
