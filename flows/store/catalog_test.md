---
mode: testing
tags: [store, catalog, smoke]
---

# Catalog browsing

## Open the storefront
Go to http://localhost:5173 and verify the heading "Small goods for focused rooms" is visible and the result count says "Showing 6 of 6 products".

## Filter by category
Click the Lighting filter and verify the result count says "Showing 3 of 6 products".

## Search for a product
Click the All filter, type "kettle" into the Search products field and verify only the Copper Pour-Over Kettle is listed, priced at $64.00.

## Open the product detail
Go to http://localhost:5173, type "halo" into the Search products field, click the Halo Task Light product name and verify the detail page shows the price $24.00 and an Add to cart button.
