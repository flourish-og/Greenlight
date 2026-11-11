# Submission

**GREENLIGHT — Red → agent → Green. Nothing ships until Kane says so.**

GREENLIGHT is an OpenCode plugin (built with the **OpenCode** AI coding agent)
that puts Kane CLI inside that same agent's own loop, for any developer who
ships with AI and wants the verification to close the loop automatically. When
the agent finishes a turn that touched app code, the plugin runs the
committed Kane CLI flows against the real app in a real Chrome; a red result goes
back into the same session as a Failure Brief (failing flow and step, screenshot,
what Kane actually saw, the bug verdict, the evidence pack), the agent fixes the
app, and the plugin re-runs the suite until it is green and writes a Loop Receipt.
The agent cannot edit the flows into passing: an integrity guard snapshots
`flows/**/*_test.md`, the recordings, the config and the plugin itself, and blocks
the run before a credit is spent if any of them changed. The repo is the whole
submission: the plugin (`.opencode/plugins/greenlight/`, 51 unit tests against
verbatim Kane streams), a Loop Board (`apps/board`) that shows the live loop and
replays a real recorded red→green run with no browser and no credits, and a
storefront (`apps/store`) whose features were built *through* the loop. It paid
off immediately: after the agent added promo codes, Kane authored a 3-step flow
and caught a real money bug — the cart and checkout showed `Total: $37.80` but
the confirmation charged `$42.00` — with an
`application_issue / ui_data_defect / major` verdict at 0.98 confidence; the agent
fixed `placeOrder` to store the discounted total, and the suite replayed 14/14
steps for **0 credits**. Two more features (free shipping over $75, gift wrap)
went through the same loop; shipping moved two earlier flow totals, the agent
updated those steps, and Kane re-verified the whole 6-flow suite — **21/21 steps
for 0 credits**. Kane also caught a wrong assertion while authoring the gift-wrap
flow (my total said `$21.99`; the correct sum is `$22.49`) and filed it as
`automation_bug / config_issue`, separating it from app defects.

## Links

- Repo: https://github.com/flourish-og/Greenlight (MIT, see `LICENSE`)
- **Live demo:** https://flourish-og.github.io/Greenlight/
- **Demo video (3 min):** https://youtu.be/6Docr4JNGQI
- Plugin: `.opencode/plugins/greenlight/` — see `docs/PLUGIN.md`
- Board: `apps/board` — `pnpm board` → http://localhost:5174
- Store: `apps/store` — `pnpm dev` → http://localhost:5173
- Flows + recordings: `flows/`, `docs/FLOWS.md`
- Receipts: `.greenlight/receipts/`
- Kane behavior notes: `docs/KANE_NOTES.md`
- Demo script: `DEMO_SCRIPT.md`

## Run it

```powershell
pnpm --dir apps/store install
pnpm --dir apps/board install
pnpm dev                        # store on :5173
pnpm --dir apps/board dev       # board on :5174
pnpm test                       # 51 plugin tests, no browser, no credits
pnpm flows:ratchet              # replay the committed store suite
```
