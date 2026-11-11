# KANE_NOTES

Verified behavior of Kane CLI **and the OpenCode plugin API** as it applies to
GREENLIGHT. Sources: the official
agent `llms.txt` / `AGENTS.md` and the docs pages (agent-mode, testmd-running,
testrun, evidence-pack-structure, evidence-debugging, cli-reference). Empirical
sections are marked **[PENDING]** until confirmed by a real run; update them and
remove the marker after the smoke test / first suite.

## Install & auth

- Install: `npm install -g @testmuai/kane-cli` (Node 18+) — user-level prefix,
  no admin. Alt: `brew install LambdaTest/kane/kane-cli`.
- Local browser runs need Google Chrome (present at
  `C:\Program Files\Google\Chrome\Application\chrome.exe`).
- Sign in: `kane-cli login --oauth` (opens browser) or the user runs
  `kane-cli login` themselves. Never ask for a key in chat.
- Check: `kane-cli whoami` (sign-in), `kane-cli balance` (credits),
  `kane-cli config show`.
- CI (no login): pass `--username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY"`
  on every command.

## NDJSON shape

- `--agent` (or stdin not a TTY) → stdout is NDJSON, one JSON object per line;
  human progress view goes to stderr.
- Every line carries `v` (stream contract version, currently `1`) and `ts`.
- First line is `{"type":"stream_start", "cli_version", "surface", "pid", ...}`.
  `surface` is `run` | `testmd` | `testrun`.
- On a `run` stream: step lines have **no** `type` field — they carry `step`,
  `status` (`running`/`done`/`failed`), `remark`. Typed events have `type`:
  `bifurcation`, `child_agent_start/end`, `ask_user`, `warning`, `error`,
  `run_end`, etc.
- Ignore unknown fields and event types; skip any line that isn't JSON.
- **Exit code first**, then read completion event.

## Exit codes

| Command | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| `run` | passed | ran & failed / upload failed | did not start (sign-in/config/Chrome/no URL) | timeout or cancelled |
| `testmd run` | passed | ≥1 non-optional step failed | parse/auth/org/Chrome/flag/lock-fail | cancelled or timed out |
| `testrun run` | all members passed | ≥1 member failed/broke | usage/invalid plan/auth (nothing ran) | cancelled only (no suite timeout) |

A `run` refused before it starts exits `2` with **no** `run_end` line.

## Completion events (what to parse)

- `kane-cli run` → `run_end` (last line of a started run). Fields to rely on:
  `status`, `summary`, `one_liner`, `reason`, `duration` (sec),
  `credits_consumed` (decimal; older releases used `credits`), `final_state`
  (stored values), `test_url` (when upload succeeded), `session_dir`. May also
  carry `result_code`, `context`.
- `kane-cli testmd run` → `test_md_done`: `overall_status`, `duration_s`,
  `session_id`, optional `share_url`. Inner `run_end` events only finish one
  step. Wait for BOTH `test_md_done` and the process exit.
- `kane-cli testrun run` → `testrun_done` (last typed event). Stream events, in
  order: `testrun_plan`, `testrun_start`, `testrun_member_start`,
  `testrun_member_end`, `testrun_investigations_wait`, `testrun_evidence_ingest`,
  `testrun_summary`, `testrun_done`. Stop parsing at `testrun_done`. `--remote`
  additionally wraps with `remote_*` and ends with `remote_done` (keep its
  `status`, `exit`, `sessions_path`).
- A `{"type":"warning","code":"unresolved_variables",...}` line means a
  `{{name}}` has no value — the run still proceeds and types the literal name.

## testmd run vs testrun run

- `testmd run <file>` runs ONE `_test.md`. First run **authors** every step
  (agent figures it out, records). Later runs **replay** each unchanged step
  from recording - no LLM cost, much faster.
- Replay happens only if a recording exists AND the step text AND its `yaml`
  block are unchanged AND no earlier step invalidated it. Editing step N
  re-authors step N **and every authorable step after it**.
- `testrun run` runs MANY `_test.md` as one execution (one summary, one exit
  code, one evidence pack). Selection: explicit paths (must end `_test.md`) or
  `--match <regex>` / `--tags <list>`. `--parallel N` workers, `--on-failure
  continue|fail-fast`.
- `testrun run` has NO `--variables` flag; use the shared `.testmuai/variables/`
  file or per-member `variables:` frontmatter.
- Members do NOT have to be authored first: a member with no recording runs as
  an "author" member during the run.

## Authoring a multi-step flow - measured

- `kane-cli run --name <flow>` writes a **single-step** `_test.md` (the whole
  objective becomes `## Step 1`) plus `output-<flow>/`.
- A hand-written multi-step `_test.md` (frontmatter `mode: testing`) is
  **authored step-by-step on the first `testmd run`** and recorded per step;
  later runs replay each step independently.
- Measured on `flows/store/catalog_test.md` (4 steps): the first authoring run
  took ~5 min. After editing only step 2, step 1 replayed in **4.2 s** while
  steps 2-4 re-authored. After editing only step 4, the whole file finished in
  **95 s** with steps 1-3 replayed.
- `testmd run` prints `step_end` lines with `kind`
  (`navigate` / `click` / `type` / `analyze` / `assert`) and writes
  `output-<stem>/Result.md`.
- Steps run with state continuity in one browser session, so a recording
  depends on the pages reached by earlier steps. Authoring steps in **separate**
  `run` calls cannot be merged into one flow.
- Step wording must match the app's exact copy. A wrong expectation
  ("3 of 3 products" vs the app's "Showing 3 of 6 products") makes Kane report a
  **confirmed product bug**, not a wording error. Write assertions against real
  rendered text.
- Two `testmd run` processes can author in parallel on one machine (no lock
  conflict observed); each opens its own Chrome.

## Replay economics - measured on this repo (2026-11-06)

| Run | Steps | Authored | Replayed | Wall time | Credits |
|---|---|---|---|---|---|
| first author, `cart_test.md` | 4 | 4 | 0 | 208 s | 68.94 |
| first author, `checkout_test.md` | 3 | 3 | 0 | 260 s | 63.64 |
| re-author `cart_test.md` after the a11y change | 4 | 4 | 0 | 353 s | 29.08 |
| re-author `checkout_test.md` after the a11y change | 3 | 3 | 0 | 479 s | 39.60 |
| full suite, replay only (`testrun-3`) | 11 | 0 | 11 | 131 s | 1.67 |
| full suite, replay only (`testrun-4`) | 11 | 0 | 11 | 99 s | 0.71 |

Credits are sums of `run_end.credits_consumed` per step (each step runs as its
own `run`, so a file total is the sum of its steps).

- Authoring lands at roughly **15-20 credits per step**; replaying the whole
  11-step suite costs **under 2 credits** and about two minutes.
- Credits are not exactly zero on replay: the browser, evidence pack and upload
  still cost a little. The `test_md_summary` fields
  `steps.author_decisions` / `steps.replay_decisions` are the honest signal for
  "did an LLM author this?" - not `credits_consumed`.
- Cost per suite run dropped between `testrun-3` and `testrun-4` with identical
  steps, so treat small credit deltas as noise, not as a measurement of work.

## Recording fragility: structured selectors vs vision coordinates

Recorded actions store a `selectors` array **or** a `coordinates` point per
action (`output-<stem>/.internal/steps/<n>-<md5>/flows/0/actions.ndjson`).

- `selectors: null` + `coordinates: {x, y}` is the fragile kind: a replay clicks
  a pixel. Any layout shift (scroll position, viewport, a taller card) misses.
- Cause: an ambiguous accessible name. Six buttons all named "Add to cart", two
  named "Remove" - the DOM resolver finds no unique target and falls back to
  vision.
- Fix at the **app**, not the test: give each control a unique accessible name
  (`aria-label={`Add ${product.name} to cart`}`,
  `aria-label={`Remove ${product.name}`}`). Re-authoring then records
  `internal:role=button[name="Add Aurora Desk Lamp to cart"i]` at score 100.
- After the fix all 19 recorded click/fill actions in the store suite use
  structural selectors; the suite has replayed green twice with
  `--no-adaptive-heal`.
- Deleting a broken step's recording directory (`.../steps/<n>-<md5>/`) forces
  that step to be re-authored. Everything after it re-authors too (state
  continuity), and the paid cost is charged per step, so fix selectors before
  authoring a long flow.

## `testrun run` event stream (measured 2026-11-06)

- `testrun_plan` `{members:[{path,test_id,tags}], …}` - the resolved plan. It
  lists **every** flow that will run, including ones that will be authored.
  `--match` is an unanchored regex over paths, so a copy under
  `.testmuai/tests/<stem>_test.md` is matched too; anchor it
  (`^flows[/\\]store[/\\]`) to keep the suite to `flows/`.
- `testrun_start` `{execution_id, members, parallel}` - `members` lists only the
  flows that will **replay**; authored flows are absent.
- Per replayed member: `testrun_member_start` `{path, test_id, session_id,
  log_path}`, the member's own event stream inside its session directory, then
  `testrun_member_end` `{path, status, duration_s, session_id, failure?}`.
  A failure is `{message: "action_failed: click @ step 1", step_index: 4}`.
- Per **authored** member (no recording yet): `testrun_authored_member_start`
  `{path, session_id, log_path}` and `testrun_authored_member_end` `{path,
  test_id, status, duration_s, session_id, log_path, failure?}`. They are
  separate event types and are NOT part of `testrun_start.members` or the
  `testrun_member_end` stream. A parser that only reads `testrun_member_end`
  silently drops the flow that actually ran the agent.
- `testrun_summary`:
  ```json
  {"execution":{"id":"…","status":"failed","evidence_id":"…"},
   "authored":[],"totals":{"tests":3,"passed":2,"failed":1,"broken":0,
                           "skipped":0,"authored":0},
   "duration_s":208.631,"upload":"ok","cancelled":false}
  ```
  `authored[]` is empty for a pure replay; on an authoring run it lists
  `{path, test_id, commit_id, execution_id, status, published}`.
- `testrun_done` `{execution_id, overall_status, coverage}` - stop here.
- Per-member detail (step-level replay/author counts) lives in
  `~/.testmuai/kaneai/sessions/<session_id>/events.ndjson` as
  `test_md_summary`. Read that when the suite summary is not enough.
- **`testrun run` does not print credits anywhere on stdout.** Sum
  `run_end.credits_consumed` from each member's own `log_path` (plus
  `run_end.verdict.credits_consumed` when a failure was judged). `testrun_summary`
  has no credit field, so a suite-level credit number must be assembled.
- The evidence pack path is on stdout in `coverage.pack` (and in
  `execution.evidence_id` as an id). `run_end` has no pack field.

## Failure verdicts - gold for the Loop Board

A failed `run_end` carries a `verdict` object (also in `per_flow_metadata`):

```json
"verdict": {
  "confirmed": true, "status": "failed",
  "family": "application_issue", "category": "functional_defect",
  "severity": "major",
  "bug_title": "Lighting filter leaves all products visible",
  "root_cause": "...", "agent_fault_assessment": "...",
  "signals": [{ "step": "1-1", "kind": "objective_contradiction", "excerpt": "..." }],
  "confidence": 0.98, "suggestion": "...", "culprit_step": "1-1",
  "relevant_steps": [1], "one_liner": "...", "mode": "terminal"
}
```

`result_code` was `740`, `reason_code` `assertion_error.confirmed_product_bug`.
`family` separates `application_issue` from agent/infra faults - the plugin's
Failure Brief should key off `verdict` first, then fall back to
`failure.yaml` / `result.yaml` inside the evidence pack.

## testmd run event stream (measured 2026-11-06)

`kane-cli testmd run <file> --agent` emits, in order:

- `stream_start` (`surface: "testmd"`).
- Per step: `test_md_step_start` `{step_index, heading, ref}`, then the normal
  `run` event block (`bifurcation`, `run_start`, `step_start`, `step_event`,
  `step_end`, `run_end`), then `test_md_step_end` `{step_index, status, duration_s}`.
- `test_md_evidence_ingest` `{status, evidence_id}`.
- `test_md_bundle_sync` `{status, commit_id, path, bytes}` - the `_test.md` path
  and size after recordings were written. The recordings live in
  `output-<stem>/.internal/` next to the flow, not in the `.testmd` file itself.
  On a failed authoring run this still reports `status: ok` and writes usable
  recordings; `commit.committed` is `false` with `reason: run_failed`.
- `test_md_summary`:
  ```json
  {"overall_status":"passed","duration_s":208,
   "steps":{"total":4,"passed":4,"failed":0,"skipped":0,
            "replay_decisions":0,"author_decisions":4},
   "adaptive_heal":{"triggered":false},
   "commit":{"committed":true,"reason":"ok","testcase_id":"…"},
   "artifacts":{"replaced":true},
   "upload":{"performed":true,"succeeded":true},
   "share_url":"…","cancelled":false}
  ```
  `replay_decisions` vs `author_decisions` is the exact "did this run cost
  credits?" signal for the Loop Board.
- `coverage` (skipped) then `test_md_done` (`overall_status`, `duration_s`,
  `session_id`, `share_url`) - the file-level completion event.

## `--no-adaptive-heal` behavior

- Adaptive healing is **on by default**. After a replay failure, the runner
  retries smaller and smaller replay windows (up to three), then fully
  re-authors the authorable steps.
- `--no-adaptive-heal` turns that recovery **off**: a replay miss fails instead
  of silently re-authoring. This is exactly what the ratchet wants (regression
  → loud failure).
- **First-authoring nuance:** a step with no recording has nothing to replay, so
  `--no-adaptive-heal` has no effect on a brand-new flow — the agent simply
  authors it. It only governs the replay path. GREENLIGHT relies on committing
  the `output-<stem>/` recordings so every later suite run is a replay, where
  `--no-adaptive-heal` is meaningful.
- `--retry` / `--retry-count` are accepted but **no-ops** (they only print a
  notice).

## Evidence pack — location & contents

- A `.evidence` file is an ordinary **zip**; `unzip -l` lists it, `unzip -p`
  prints an entry.
- Location by command:
  - `kane-cli run`: `<session_dir>/evidence/`; copied to `.testmuai/evidence/`
    when `--name` is used.
  - `testmd run` / `testrun run`: in `.testmuai/evidence/`.
- `run_end` has NO field for the pack path; Kane prints a hint on **stderr**:
  `evidence: view locally with 'kane-cli evidence serve <path>'`.
- Layout (L1):
  ```
  <execution_id>.evidence
  ├── run.yaml              # manifest: title, status, totals
  ├── failure.yaml          # run-level failure rollup
  └── tests/<test-id>/
      ├── test.md           # the test definition
      ├── result.yaml       # verdicts + per-step outcomes
      ├── logs/
      │   ├── meta.yaml
      │   ├── tui.log
      │   ├── <n>-run.log
      │   ├── <n>-actions.ndjson
      │   ├── <n>-console.ndjson
      │   └── <n>-network.har
      └── steps/<ordinal>-<step-id>/
          ├── screenshot.png
          ├── annotated.png
          ├── step.json
          └── failure.yaml   # failed/broken steps only
  ```
- In a `testrun` pack, each member gets its own `tests/<id>/` dir.
- Verdicts: `passed` | `failed` (product is wrong) | `broken` (couldn't run —
  env/infra/test fault) | `skipped`. Do NOT conflate `failed` and `broken`.

## Extracting failure info (for the plugin's Failure Brief)

1. Exit code ≠ 0 → failing step + remark.
2. For `testmd run`: `output-<stem>/Result.md` is the human-readable report
   (frontmatter + per-step `✓ passed` / `✗ failed` / `⏭ skipped` with the step
   text and duration). It includes the failing step text.
3. For deeper detail, read the evidence pack:
   - `tests/<id>/result.yaml` — per-step verdicts.
   - `tests/<id>/steps/<ordinal>-<id>/failure.yaml` — `error.message`,
     `expected` vs `actual`, page state, refs into console/network logs.
   - `tests/<id>/steps/<ordinal>-<id>/screenshot.png` (+ `annotated.png`) — the
     failure screenshot path to show.
   - console errors: `logs/<n>-console.ndjson`; network errors: `logs/<n>-network.har`
     (look for 4xx/5xx).
   - Root `failure.yaml` indexes every failure in the run.
4. Viewer: `kane-cli evidence serve <pack>` (serves locally, uploads nothing);
   use the printed `viewer` URL.

## Credits

- **Measured (smoke run, 2026-11-06):** a 3-step `run` (navigate + analyze +
  assert) cost **11.278525 credits**, 28.3 s wall clock. Matches the docs'
  example of ~11.9. Budget ~12 credits per short objective; a 5–8 step flow is
  likely 20–40.
- **Measured (Phase 1/2 authoring, 2026-11-06/07):** authoring lands at roughly
  **15-25 credits per step**. A failed authoring run still writes valid
  recordings (`run_kind: author`, `valid: true`) into `output-<stem>/`, so the
  next run can replay them even though `commit.committed` is `false` with
  `reason: run_failed`.
- **Measured (replay-only suite, 2026-11-10):** 14 steps / 4 flows in 279.7 s
  cost **0 credits** (`steps.authored: 0`, `steps.replayed: 14`). Phase 1 saw
  1.67 and 0.71 credits for 11 steps; treat sub-credit replay charges as
  browser/evidence/upload noise, not LLM work.
- Replays of unchanged steps cost **no LLM credits** (this is why committing
  `output-<stem>/` matters). `author_decisions` / `replay_decisions` in
  `test_md_summary` is the honest "did an LLM write this?" signal.
- **Flaky replays are real.** Two consecutive replay-only suite runs failed on
  different flows without an app change: `catalog_test.md` step 4
  (`action_failed: wait @ step 4` on `check_until_condition "the heading … is
  visible"` while the screenshot showed the correct page) and `promo_test.md`
  step 2 (`analyzer_failed: @ step 5`). The same steps passed standalone and on
  the next suite run. Treat a single red replay as a hypothesis, not proof: read
  the screenshot + verdict, re-run before changing the app.

## Smoke run — real result (2026-11-06)

Command (PowerShell, from the repo):

```powershell
$env:KANE_CLI_USER_AGENT='greenlight'
kane-cli run "Go to https://example.com and verify the page heading says Example Domain" --agent --headless
```

Exit `0`. Raw NDJSON committed at
`docs/evidence/phase0-smoke-run-2026-11-06.ndjson`. Key `run_end` fields:

| Field | Value |
|---|---|
| `status` | `passed` |
| `duration` | `28.3` s |
| `credits_consumed` | `11.278525` |
| `final_state` | `{ "url": "https://example.com/", "page_heading": "Example Domain" }` |
| `result_code` / `reason_code` | `100` / `success.complete` |
| `test_url` | Lambdatest share URL (present) |
| `session_dir` | `C:\Users\flour\.testmuai\kaneai\sessions\1b3618e6-…` |
| `coverage` | `{ "status": "skipped", "reason": "not_assurance_project" }` |

Observed stream shape (confirms the docs and adds detail):

- First typed event: `stream_start` (`cli_version 0.10.2`, `surface "run"`).
- `recording_state` (`enabled true`, `persist false`) — recording is on by
  default even without `--name`.
- `project_folder_auto_defaulted` — first run auto-created project
  "KaneAI Generated" / folder "Untitled" and printed a `config project` hint.
- `bifurcation` with `flows` — my single objective became ONE flow
  (`["Navigate to https://example.com then verify the page heading says Example Domain"]`).
- Step lines have **no `type`**, start at `step: 2` (1 is the bifurcation), and
  carry `remark` like `navigate: …`, `analyze: …`, `assert: …`.
- `coverage` event (`status skipped`, `pack <path>`) arrives **before**
  `run_end`; it is the only place the pack path appears on stdout.
- `run_end` is last; `test_url`, `context.memory`, `context.variables`,
  `per_flow_metadata[]`, `run_id` all present.

Evidence pack: `<session_dir>\evidence\<uuid>.evidence` — 166 KB zip, 21
entries, matching the documented layout (`run.yaml`, `failure.yaml`,
`tests/<id>/result.yaml`, `logs/0-{actions.ndjson,console.ndjson,network.har,run.log}`,
`steps/<n>-<id>/screenshot.jpg` + `step.json`). Screenshots were `.jpg` here,
not `.png` as the docs show.

## OS quirks (Windows / PowerShell)

- PowerShell has no `<` input redirect, so always use `--agent` on
  `testrun run` / `testmd run` (never rely on `</dev/null`).
- Tag the runtime per-command (an `export`/set does not persist across shell
  calls in agent hosts):
  `$env:KANE_CLI_USER_AGENT='greenlight'; kane-cli run ...`
- In a double-quoted objective, escape `$` as `\$` (PowerShell also expands `$`,
  and bash turns `$42.00` into `2.00`).
- `--match` regex uses the OS path separators (`flows\store\` on Windows). In
  cmd.exe wrap the regex in double quotes (single quotes are literal); in
  PowerShell pass it as a normal quoted string. Our ratchet uses
  `--match '^flows[/\\]store[/\\]'` so it works on both separators.
- Evidence/Result file paths use `<stem>` without the `_test.md` suffix, e.g.
  `output-checkout/`.

## Empirical findings (installed `@testmuai/kane-cli@0.10.2`)

Confirmed against the actual binary's `--help` output:

- Installed version **0.10.2** (docs referenced 0.9.0/0.8.21). First NDJSON line
  is `stream_start`; `--agent` on `testrun run` supported.
- **`testrun run` has NO `--timeout` flag.** The brief's ratchet command ends in
  `--timeout 300`, which `testrun run` does not accept (would be an unknown flag
  → exit 2). `testmd run` DOES have `--timeout <s>` ("kill after N seconds").
  **Action:** drop `--timeout` from the `testrun run` ratchet invocation; pass it
  only to `testmd run` (or rely on the host shell timeout).
- `testrun run` extra flags in 0.10.2 not in the older docs: `--stream-members`
  (agent mode: also print every member's own events on stdout wrapped as
  `testrun_member_event` under a member key — default is per-member
  `events.ndjson` named by `log_path`), `--policy`/`--policy-id`, `--env`
  (prod|stage), `--assertion-failure-mode`, `--override-start-url`,
  `--from-context`, `--dataset-*`. `--stream-members` is the clean way for the
  plugin to get per-flow step detail from one `testrun run` stream.
- `testmd run --mode agent` is accepted as "same as `--agent`".

## Discrepancies vs the brief (rule 6)

- The brief's ratchet command includes `--timeout 300` on `testrun run`, which is
  not a valid flag for that subcommand (see above). Plugin will omit it.
- The brief references the OpenCode v1 plugin package `@opencode-ai/plugin` and
  hook/event names `file.edited` / `client.session.prompt`. The running OpenCode
  is **v2** (2.1.4): the package is `@opencode/plugin`, `file.edited` maps to the
  `filesystem.changed` event, and re-prompt is `ctx.session.prompt({ sessionID, text })`.

## OpenCode plugin API — verified (v2, running 2.1.4)

Proven with a throwaway probe plugin (`.opencode/plugins/probe.ts`) writing
`.greenlight/debug.log`:

- **Plugin load:** `.opencode/plugins/*.ts` files auto-discover. `Plugin.define({ id, setup(ctx) })`
  from `@opencode/plugin`. `setup` gets `ctx.app.version`, `ctx.location.directory`.
- **`tool.execute.after` hook** (`ctx.tool.hook("execute.after", fn)`) fires with
  `{ tool, sessionID, agent, messageID, id, input, status: "completed"|"error", result|error }`.
  For the `write`/`edit`/`patch` tools, `input.path` is the edited file. **This is
  the reliable edit-tracker.**
- **`filesystem.changed` (the v2 `file.edited`) does NOT fire** for tool writes
  (`write`/`edit`) or for external writes (`Add-Content` from shell) in this
  setup. Do not rely on it; use `tool.execute.after` + `input.path` instead.
- **`ctx.event.subscribe({ types: [...] })` does NOT filter at runtime** in 2.1.4 —
  both a `types:["filesystem.changed"]` and a `types:["session.idle"]` subscription
  received the full event stream. Filter manually by `event.type`. (The
  `SubscribeOptions.types` is present in the SDK types but not applied here.)
- **`ctx.session.prompt({ sessionID, text })` re-prompts the same session from
  inside a handler without deadlocking.** Returned the admitted inbox item in
  ~5 ms (`{ id, sessionID, time, type, payload, delivery }`). Fire-and-forget +
  a re-entrancy guard is the safe pattern.
- `session.idle` **event** and `ctx.session.hook("experimental.idle")` both exist in the
  types, but neither is usable as the loop trigger in 2.1.4 — see the table below.
- OpenCode runs as **Desktop v2.1.4** (`...\cli\2.1.4-x64\opencode-cli.exe`). The
  plugin SDK is provided at runtime; no local `node_modules` needed to load plugins.

### Turn lifecycle — what actually fires (probe v3, 2026-11-06)

Observed across four turn boundaries (~1,500 log lines, unfiltered event stream,
manual `.type` filter in the probe):

| Signal | Fires? | Notes |
|---|---|---|
| `session.execution.started` | ✅ once per turn | `data: { sessionID }`; arrives with `session.inbox.delivered` |
| `session.execution.succeeded` | ✅ once per turn | **0.4 s after the last `session.step.ended`** — this is "agent is idle" |
| `session.execution.failed` / `session.execution.interrupted` | types exist, not yet observed | same shape; siphon off as failure paths |
| `session.step.ended` | ✅ per step (1 per tool turn) | progress only — not completion |
| `session.text.ended` | ✅ per reply | fires *before* `execution.succeeded` |
| `session.idle` (event) | ❌ never | 0 occurrences in the whole log |
| `session.status` (event) | ❌ never | `{ status: { type: "idle" \| "busy" \| "retry" } }`; not emitted |
| `ctx.session.hook("experimental.idle", fn)` | ❌ registered fine, never invoked | docs say it runs "just before it goes idle" |
| `filesystem.changed` | ❌ never | see above |

**Decision for GREENLIGHT:** the loop trigger is the `session.execution.*` family
(`started` → work → `succeeded` | `failed` | `interrupted`). Keep
`experimental.idle` registered as a best-effort extra signal, but nothing may
depend on it. `ctx.session.wait({ sessionID })` also exists (blocks until the
session is idle) — handy in tests, not inside the idle handler itself.

Verbatim proof from `.greenlight/debug.log` (timestamps UTC):

```
22:41:01.507 {"event":"session.step.ended","sessionID":"ses_e4d1…"}
22:41:01.508 {"event":"session.usage.updated","sessionID":"ses_e4d1…"}
22:41:01.511 {"event":"session.execution.succeeded","sessionID":"ses_e4d1…"}
22:42:00.665 {"event":"session.execution.started","sessionID":"ses_e4d1…"}   ← next turn
```
