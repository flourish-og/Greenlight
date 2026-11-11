# Evidence

Real command output, trimmed to the lifecycle events that matter. Nothing here
is hand-written or simulated; each `.ndjson` file is a filtered copy of the
NDJSON that `kane-cli` actually printed, and each `.jpg` is a screenshot Kane
captured during a run.

| File | What it is |
|---|---|
| `phase0-smoke-run-2026-11-06.ndjson` | First `kane-cli run --name` smoke test against example.com (exit 0). |
| `phase1-ratchet-red-2026-11-06.ndjson` | `testrun run --no-adaptive-heal` that failed 1/3: cart step 4 clicked a vision coordinate because two buttons shared the name "Remove". |
| `phase1-ratchet-1-2026-11-06.ndjson` | First clean replay-only suite after the accessible-name fix: 3/3 tests, 11/11 steps, `authored: 0`. |
| `phase1-ratchet-2-2026-11-06.ndjson` | Second consecutive clean replay-only suite: same result. |
| `phase1-catalog-2026-11-06.jpg` | Kane's step screenshot of the catalog (replayed). |
| `phase1-cart-2026-11-06.jpg` | Kane's step screenshot of the cart after the quantity change. |
| `phase1-order-confirmed-2026-11-06.jpg` | Kane's step screenshot of the confirmation page, order `GL-1001`. |

Full unfiltered streams are gitignored in `.greenlight/`; the evidence packs are
in `.testmuai/evidence/` and can be opened with
`kane-cli evidence serve <pack>`.
