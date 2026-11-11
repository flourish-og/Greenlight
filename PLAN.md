# GREENLIGHT — Plan

> Red → agent → Green. Nothing ships until Kane says so.

A one-week hackathon build (Kane CLI Online Hackathon, TestMu AI, 12–19 Nov 2026).
Three parts in one repo:

- **A) Plugin** — `.opencode/plugins/greenlight.ts`: closes the loop between
  OpenCode and Kane CLI.
- **B) Loop Board** — `apps/board`: live (and recorded replay) view of the loop.
- **C) Storefront** — `apps/store`: a deterministic Vite+React+TS demo target;
  every feature beyond baseline is built only through the loop.

## Scoring targets (all four weighted equally)

1. **Ships** — real app, one-command run and/or deployed, no mocks.
2. **Verified** — Kane CLI caught/confirmed something meaningful (a real
   red→green loop, a regression caught by the ratchet).
3. **Closed loop** — agent output triggers Kane runs; Kane results trigger the
   agent to act. Tight loop.
4. **Craft** — interesting, installable tonight.

## Phases

- [x] **Phase 0 — Learn & verify.** Docs read; kane-cli install+login; smoke
  run (passed, 11.28 credits); KANE_NOTES; OpenCode plugin probe
  (`tool.execute.after`, `session.execution.*` as the real idle signal,
  `ctx.session.prompt` re-prompt without deadlock).
- [x] **Phase 1 - Storefront + baseline flows.** Build C, 3 baseline flows
  green via `testrun run`, commit recordings.
- [x] **Phase 2 - Plugin v1.** Build A end-to-end; prove on "add promo codes"
  (red → implement → green). Integrity guard, credit budget, Loop Receipt.
- [x] **Phase 3 — Loop Board.** Build B (live + replay) + `flows/board/` flows.
- [ ] **Phase 4 — Playground.** Feature-request box via `opencode serve` +
  `verify_with_kane` tool. **Cut** (the brief allows it; time went to Phases 3/5).
- [x] **Phase 5 — Hardening & proof.** 4+ real features through the loop
  (promo codes, free shipping, gift wrap; the shipping change moved two earlier
  flow totals, which were re-authored), recorded replays, GitHub Actions
  ratchet, README, deploy replay build, DEMO_SCRIPT.md, one-paragraph
  submission.
- [x] **Phase 6 — Freeze.** Bug fixes + README + demo only; clean-clone verify.

## Hard rules (abridged — see brief)

1. `git init` first; commit early/often; never squash/rewrite/force-push.
2. Everything written during the event; no imported old code.
3. Never fake anything; recorded fixtures must come from a real run and be
   labeled as recordings.
4. All browser verification uses `kane-cli` (never Playwright/Puppeteer/Selenium).
5. Never ask for tokens/passwords in chat; secrets stay out of git.
6. Trust docs + actual behavior over this brief; log discrepancies in
   `docs/KANE_NOTES.md`.

## Repo layout (target)

```
.opencode/plugins/greenlight.ts
apps/board/               Node (Hono) + Vite/React — live + replay board
apps/store/               Vite + React + TS — demo target (no backend)
flows/store/              *_test.md baseline flows (+ output-<stem>/ recordings)
flows/board/              *_test.md flows verifying the board itself
fixtures/recorded/        real-run JSON recordings for replay mode (committed)
.greenlight/              runtime data (live.ndjson, receipts, loop records)
docs/KANE_NOTES.md        verified Kane behavior + OS quirks
```

## Decisions log (see PROGRESS.md for status)

- Repo location: fresh `C:\Users\flour\Desktop\greenlight` (this dir). The
  pre-existing `Campus Run` repo (a different product) is left untouched.
