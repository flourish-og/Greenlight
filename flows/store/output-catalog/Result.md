---
test: ../catalog_test.md
status: passed
started: 2026-11-06T23:00:52.844Z
duration_s: 95
session_id: ef0cb4c7-99bd-4eec-9324-c43e8246bd4a
---

# Catalog browsing — Result

## Open the storefront ✓ passed (1.81s)
md5: 7165d0a747e6f1dcfe6a670d538b0125
Go to http://localhost:5173 and verify the heading "Small goods for focused rooms" is visible and the result count says "Showing 6 of 6 products".

## Filter by category ✓ passed (1.05s)
md5: 852a09e03c5055bfd9bf0b1a8331e620
Click the Lighting filter and verify the result count says "Showing 3 of 6 products".

## Search for a product ✓ passed (2.28s)
md5: 3df29aaeb92a6e8b11542bc663c58786
Click the All filter, type "kettle" into the Search products field and verify only the Copper Pour-Over Kettle is listed, priced at $64.00.

## Open the product detail ✓ passed (65.9s)
md5: 0256a3e38810aa1f4998d929a14fc02e
Go to http://localhost:5173, type "halo" into the Search products field, click the Halo Task Light product name and verify the detail page shows the price $24.00 and an Add to cart button.
