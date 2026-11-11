# The GREENLIGHT plugin

`.opencode/plugins/greenlight/` is a directory plugin for OpenCode 2.x. It
closes the loop: app code changes → Kane CLI suite → red goes back to the agent,
green writes a Loop Receipt.

## Files

| File | Responsibility |
|---|---|
| `index.ts` | Wiring: config, session state, the `greenlight_verify` tool, the `tool.execute.after` edit tracker, the `session.execution.succeeded` auto-trigger, the run queue, and receipt writing. |
| `config.ts` | `greenlight.config.json` loader + defaults (`app`, `flows`, `loop`, `integrity`, `receiptsDir`). |
| `glob.ts` | Tiny glob matcher for `editGlobs` / `integrity.protect`. No dependency. |
| `integrity.ts` | Snapshot + diff of protected files (tests, recordings, config, plugin) so the agent cannot edit a test into passing. |
| `kane.ts` | Kane runner + NDJSON parser. Reads `testrun` / `run` streams, then enriches from each member's own `log_path` (step totals, failing step, screenshot, observed values, bug verdict, credits). Builds the Failure Brief. |
| `loop.ts` | Pure decision logic: `shouldAutoVerify()` and `decide()` (green / red / budget / max-iterations / stalled). |
| `receipt.ts` | Loop Receipt JSON + Markdown, the append-only `index.ndjson`, the live stream, and raw run logs. |

Everything except `index.ts` is pure and unit-tested with `node --test`
(Node 22 strips the TypeScript types). See `tests/plugin/`.

## Triggers

1. **Explicit tool** — `greenlight_verify({ reason?, objective? })`. Works from
   any session. Without `objective` it runs the committed suite
   (`testrun run --match <flows.match> --agent --headless --no-adaptive-heal`).
   With `objective` it runs one `kane-cli run` instead.
2. **Automatic** — on `session.execution.succeeded` (the real turn-end signal in
   OpenCode 2.1.4), if the turn edited an `app.editGlobs` file, the plugin runs
   the suite and, on red, calls `ctx.session.prompt` with the Failure Brief in
   the same session. A red with no app edit is **not** re-run (saves credits).

Kane runs are serialized through a promise queue: two Chrome sessions at once
would fight over the port.

## The loop

```
verify()
  ├─ integrity snapshot/diff ── changed protected file? → receipt: integrity_blocked (no credits)
  ├─ health-probe app.startUrl ─ down? → optional dev-server start → receipt: target_unreachable
  ├─ kane-cli testrun run … --no-adaptive-heal
  ├─ enrichResult() reads each member's events.ndjson
  │     → step totals, failing step, screenshot, observed values, verdict, credits
  ├─ buildFailureBrief()
  ├─ decide(result, state, config)
  │     green              → write receipt, stop
  │     stop (budget/max)  → write receipt, stop
  │     red                → write receipt, prompt the agent with the brief
  └─ writeRunLog() saves the raw NDJSON under .greenlight/runs/
```

`decide()` uses `state.attempts` / `state.credits` **including** the run being
decided. Stops when `credits > maxCreditsPerSession`, when
`attempts >= maxIterations`, or when a red arrives after the last allowed
attempt. `shouldAutoVerify()` refuses to re-run a red when no app file changed.

## Receipts

`.greenlight/receipts/` is committed; everything else under `.greenlight/` is
gitignored. Each pass writes:

- `<stamp>-<loop>.json` — machine-readable receipt (attempts, members, steps,
  verdict, evidence, credits, integrity, target).
- `<stamp>-<loop>.md` — the human table plus the raw-stream paths.
- `index.ndjson` — one line per receipt, appended, for the Loop Board.

`.greenlight/runs/<stamp>-<loop>-a<n>.ndjson` keeps the exact Kane stdout so a
receipt can be re-parsed later without spending a credit.

## Configuration

`greenlight.config.json` at the repo root. Defaults live in `config.ts`:

```json
{
  "app": {
    "startUrl": "http://localhost:5173",
    "devCommand": "pnpm --dir apps/store dev",
    "editGlobs": ["apps/store/src/**"],
    "devServer": { "autoStart": true, "timeoutMs": 90000 }
  },
  "flows": { "match": "^flows[/\\\\]store[/\\\\]", "timeoutMs": 900000 },
  "loop": { "auto": true, "maxIterations": 3, "maxCreditsPerLoop": 80, "maxCreditsPerSession": 200 },
  "integrity": {
    "protect": ["flows/**/*_test.md", "greenlight.config.json", "package.json", "apps/store/package.json", ".opencode/plugins/**/*.ts"],
    "allowFlowEdits": false
  },
  "receiptsDir": ".greenlight/receipts"
}
```

## Known limitations

- The integrity baseline is in-memory per session. A plugin reload (any edit to
  `.opencode/plugins/**/*.ts`) re-baselines, so an edit made *before* the reload
  is not caught. The receipts still record what changed during a loop.
- `kane-cli`'s replay analyzers are occasionally flaky (see
  `docs/KANE_NOTES.md`). The plugin reports the screenshot + verdict and does
  not retry on its own; a human or the agent can call the tool again.
- The board tails files; there is no websocket. Polling `.greenlight/live.ndjson`
  is the contract.
