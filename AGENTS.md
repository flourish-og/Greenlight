# Kane CLI rules for this repository

This file teaches any coding agent (and the Greenlight plugin) how to run Kane
CLI correctly in this repo. It mirrors the official instructions at
https://www.testmuai.com/kane-cli-agent/AGENTS.md, narrowed to what matters here.

## Invocation

- The `run` subcommand is mandatory. `kane-cli "<objective>"` does NOT work and
  exits `2`. Always write `kane-cli run "<objective>" ...`.
- Always pass `--agent` so stdout is NDJSON (one JSON object per line).
- Always pass `--headless` in CI, over SSH, or when there is no display.
- Tag each command with your runtime (attribution):
  PowerShell: `$env:KANE_CLI_USER_AGENT='greenlight'; kane-cli run ...`
  (an `export` does not survive between shell calls in most hosts).
- Browser runs take 30s–several minutes. Give the shell a longer timeout than
  `--timeout` (allow up to 10 minutes), or the host kills the run before `run_end`.

## Objectives (flows)

- Start with a URL (`Go to http://localhost:5173 and ...`) or pass `--url`.
- End with an assertion about the *outcome*, not the trigger. Never
  `verify the Submit button is visible` (it disappears on success). Write
  `verify the confirmation message is visible`.
- Keep a flow ≤ 15 steps. Split longer jobs into separate runs.
- Handle optional elements conditionally: `if a cookie banner is visible, close it`.
- In a double-quoted objective, escape `$` as `\$`.
- Objectives must never need mid-run input; prompts are disabled when stdin is
  not a TTY.
- `store X as 'name'` captures a value into `run_end.final_state`. Refer to a
  stored value in plain English, never as `{{name}}` (that's for variables/secrets).

## Reading output — exit code first

| Exit | Meaning (kane-cli run) |
|------|------------------------|
| 0    | passed |
| 1    | ran and failed (or upload failed) |
| 2    | did not start (sign-in, config, Chrome, no start URL). Nothing ran, no credits used. |
| 3    | timeout or cancelled |

Read the exit code before parsing NDJSON. A run refused before it starts exits
`2` with no `run_end` line. `run_end` is the last line of a run that started.
Fields to rely on: `status`, `summary`, `one_liner`, `reason`, `duration`,
`credits_consumed`, `final_state`, `test_url`, `session_dir`. Ignore unknown
fields and event types.

`testmd run` ends with `test_md_done` (`overall_status`, `duration_s`,
`session_id`, optional `share_url`). `testrun run` ends with `testrun_done`.
Individual `run_end` events inside a testmd/testrun stream only finish one step.

## Saved tests / flows

- Flow files must end in `_test.md`.
- Commit the `output-<stem>/` folder next to each flow so replays are free and
  reproducible. Replays of unchanged steps cost no LLM credits.
- Editing step N re-authors step N and everything after it — edit flows
  minimally, only the step that changed.
- `--no-adaptive-heal` (on `testmd run` / `testrun run`) makes a replay miss
  FAIL instead of silently re-authoring. Use it for the ratchet suite so a
  regression fails loudly. It has no effect on a first authoring run (there is
  no recording to replay yet).

## Ratchet suite (this repo)

```bash
kane-cli testrun run --match '^flows[/\\]store[/\\]' --headless --agent --no-adaptive-heal --timeout 300
```

`testrun run` exit codes: `0` all passed, `1` a member failed/broke, `2` nothing
ran (usage/invalid plan/sign-in), `3` cancelled only.

## Evidence

Every run that starts seals a `.evidence` pack (a zip) with per-step
screenshots, console and network logs, and failure records.
- `kane-cli run`: under `run_end.session_dir/evidence/` (copied to
  `.testmuai/evidence/` when `--name` is used).
- `testmd run` / `testrun run`: in `.testmuai/evidence/`.
Do NOT commit `.testmuai/evidence/`. View with `kane-cli evidence serve <pack>`.

## Secrets

- Never ask for, or echo, an access key/password/token in chat.
- Secrets go in a variables file the user fills in
  (`.testmuai/variables/local.json`), referenced as `{{name}}`, marked
  `"secret": true`, and kept out of git.
- CI uses `--username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY"` per command.
