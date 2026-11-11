# Greenlight Store

A deterministic demo storefront. It has no backend, no network calls and no
randomness, so a browser agent sees the same six products, the same prices and
the same cart maths on every run.

## Run it

```powershell
pnpm install
pnpm dev          # http://localhost:5173
```

## What it does

- Catalog with category filters and a search field (`Showing N of 6 products`).
- Product detail view.
- Cart with quantity steppers and a subtotal in cents (no float drift).
- Checkout with custom validation (no native browser bubbles) and a confirmation
  page that prints a deterministic order number (`GL-1001`, `GL-1002`, ...).

## Why it exists

This app is the target that Kane CLI drives. Baseline flows live in
`flows/store/` and replay from their committed recordings; every feature added
after the baseline is supposed to arrive through the Greenlight loop:
red run -> agent change -> green run.
