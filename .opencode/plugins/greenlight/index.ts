/**
 * GREENLIGHT - the OpenCode <-> Kane CLI loop.
 *
 * Red -> agent -> Green. Nothing ships until Kane says so.
 *
 * Triggers:
 *  - the `greenlight_verify` tool (explicit, works in any session), and
 *  - the end of a turn that changed app code (`session.execution.succeeded`),
 *    which is the real turn-end signal in OpenCode 2.1.4 (see docs/KANE_NOTES.md).
 *
 * On red, the Failure Brief is sent back into the same session so the agent can
 * fix the app. On green, the Loop Receipt is written and the loop stops.
 */
import { Plugin } from "@opencode/plugin"
import { spawn } from "node:child_process"
import { join } from "node:path"
import { loadConfig } from "./config.ts"
import { matchesAny } from "./glob.ts"
import { diffSnapshots, snapshot } from "./integrity.ts"
import { buildFailureBrief, runKane, type KaneResult } from "./kane.ts"
import { decide, newSessionState, shouldAutoVerify, type SessionState } from "./loop.ts"
import {
  addAttempt,
  appendLive,
  attemptFromResult,
  newReceipt,
  renderReceiptMarkdown,
  writeReceipt,
  writeRunLog,
  type LoopReceipt,
} from "./receipt.ts"

const EDIT_TOOLS = new Set(["write", "edit", "patch", "multiedit"])

interface VerifyInput {
  reason?: string
  objective?: string
}

export default Plugin.define({
  id: "greenlight",
  async setup(ctx) {
    const root = ctx.location.directory
    const config = loadConfig(root)
    const states = new Map<string, SessionState>()

    // Kane runs are serialized: two browsers at once would fight for the port.
    let queue: Promise<unknown> = Promise.resolve()
    function enqueue<T>(task: () => Promise<T>): Promise<T> {
      const run = queue.then(task, task)
      queue = run.catch(() => undefined)
      return run
    }

    await appendLive(root, {
      event: "plugin.loaded",
      root,
      auto: config.loop.auto,
      match: config.flows.match,
      protect: config.integrity.protect,
    })

    function toRepoPath(path: string | undefined): string | undefined {
      if (!path) return undefined
      const normalized = path.replaceAll("\\", "/")
      const rootNorm = root.replaceAll("\\", "/").replace(/\/+$/, "")
      if (normalized === rootNorm) return undefined
      if (normalized.startsWith(`${rootNorm}/`)) return normalized.slice(rootNorm.length + 1)
      if (!/^[a-zA-Z]:\//.test(normalized) && !normalized.startsWith("/")) return normalized
      return undefined
    }

    function stateFor(sessionID: string, objective?: string): SessionState {
      let state = states.get(sessionID)
      if (!state) {
        state = newSessionState(sessionID, objective ?? "", `gl-${Date.now().toString(36)}-${sessionID.slice(-6)}`)
        states.set(sessionID, state)
      }
      if (objective) state.objective = objective
      return state
    }

    async function say(sessionID: string, text: string) {
      try {
        await ctx.session.synthetic({ sessionID, text })
      } catch {
        await appendLive(root, { event: "synthetic.failed", sessionID, text })
      }
    }

    async function targetReachable(url: string): Promise<boolean> {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3_000) })
        return response.ok || response.status < 500
      } catch {
        return false
      }
    }

    async function ensureTarget(): Promise<LoopReceipt["target"]> {
      const url = config.app.startUrl
      if (await targetReachable(url)) return { url, reachable: true, startedByPlugin: false }
      if (!config.app.devServer.autoStart) return { url, reachable: false, startedByPlugin: false }

      await appendLive(root, { event: "devserver.start", command: config.app.devCommand })
      try {
        const child = spawn(config.app.devCommand, {
          cwd: root,
          shell: true,
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        })
        child.unref()
      } catch (error) {
        await appendLive(root, { event: "devserver.failed", error: String(error) })
        return { url, reachable: false, startedByPlugin: false }
      }

      const deadline = Date.now() + config.app.devServer.timeoutMs
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1_500))
        if (await targetReachable(url)) return { url, reachable: true, startedByPlugin: true }
      }
      return { url, reachable: false, startedByPlugin: true }
    }

    async function finalize(state: SessionState, receipt: LoopReceipt, notify: string) {
      receipt.endedAt = new Date().toISOString()
      const written = await writeReceipt(root, config.receiptsDir, receipt)
      await appendLive(root, {
        event: "loop.finished",
        loopID: receipt.loopID,
        sessionID: state.sessionID,
        outcome: receipt.outcome,
        credits: receipt.totals.credits,
        attempts: receipt.attempts.length,
        receipt: written.jsonPath,
      })
      await say(state.sessionID, `${notify}\n\nReceipt: ${written.jsonPath}`)
      return written
    }

    async function verify(
      sessionID: string,
      input: VerifyInput,
      trigger: LoopReceipt["trigger"],
    ): Promise<{ receipt: LoopReceipt; result?: KaneResult; receiptPath: string; message: string }> {
      const state = stateFor(sessionID, input.reason)
      if (state.inFlight) {
        return {
          receipt: newReceipt({
            loopID: state.loopID,
            sessionID,
            objective: state.objective,
            trigger,
            target: { url: config.app.startUrl, reachable: true, startedByPlugin: false },
            integrity: { ok: true, checked: 0, changed: [] },
          }),
          receiptPath: "",
          message: "GREENLIGHT: a verification is already running for this session.",
        }
      }

      state.inFlight = true
      const receipt = newReceipt({
        loopID: state.loopID,
        sessionID,
        objective: input.objective ?? state.objective,
        trigger,
        target: { url: config.app.startUrl, reachable: false, startedByPlugin: false },
        integrity: { ok: true, checked: 0, changed: [] },
      })
      await appendLive(root, { event: "verify.start", loopID: state.loopID, sessionID, trigger, input })

      try {
        // 1. Integrity: the agent may not edit the tests into passing.
        const current = snapshot(root, config.integrity.protect)
        if (!state.integrityBaseline) state.integrityBaseline = current
        const changed = diffSnapshots(state.integrityBaseline, current)
        receipt.integrity.checked = Object.keys(current).length
        if (changed.length > 0 && !config.integrity.allowFlowEdits) {
          receipt.integrity.ok = false
          receipt.integrity.changed = changed
          receipt.outcome = "integrity_blocked"
          const message = [
            "GREENLIGHT: BLOCKED - protected files changed since this loop started.",
            ...changed.map((path) => `  ${path}`),
            "",
            "Revert those edits (tests, recordings, config, plugin). Kane was not run, so no credits were spent.",
          ].join("\n")
          const written = await finalize(state, receipt, message)
          state.outcome = "integrity_blocked"
          return { receipt, receiptPath: written.jsonPath, message }
        }

        // 2. Target: Kane needs the app up.
        const target = await ensureTarget()
        receipt.target = target
        if (!target.reachable) {
          receipt.outcome = "target_unreachable"
          const message = `GREENLIGHT: ${target.url} is not reachable and the dev server did not come up. Nothing ran.`
          const written = await finalize(state, receipt, message)
          state.outcome = "target_unreachable"
          return { receipt, receiptPath: written.jsonPath, message }
        }

        // 3. Run Kane.
        const args = input.objective
          ? ["run", input.objective, "--agent", "--headless"]
          : ["testrun", "run", "--match", config.flows.match, "--agent", "--headless", "--no-adaptive-heal"]
        await appendLive(root, { event: "kane.start", loopID: state.loopID, args })
        const startedAt = new Date().toISOString()
        const { result, lines } = await enqueue(() =>
          runKane({
            root,
            args,
            timeoutMs: config.flows.timeoutMs,
            onLine: (event) => {
              if (event.type === "testrun_member_end" || event.type === "run_end" || event.type === "error") {
                void appendLive(root, { event: "kane.event", loopID: state.loopID, type: event.type })
              }
            },
          }),
        )

        // 4. Book this run, then decide. The brief must exist before decide()
        //    can hand it back to the agent.
        const project = (base: SessionState): SessionState => ({
          ...base,
          attempts: base.attempts + 1,
          credits: Math.round((base.credits + result.credits) * 100) / 100,
        })
        const now = project(state)
        state.attempts = now.attempts
        state.credits = now.credits
        state.dirty.clear()
        state.lastStatus = result.status
        result.failureBrief = buildFailureBrief(result, {
          attempt: state.attempts,
          maxIterations: config.loop.maxIterations,
          command: result.command,
        })
        const decision = decide(result, now, config)

        const attempt = attemptFromResult(state.attempts, input.objective ? "objective" : "suite", result, startedAt)
        try {
          attempt.stream = await writeRunLog(root, config.receiptsDir, state.loopID, state.attempts, lines)
        } catch (error) {
          await appendLive(root, { event: "runlog.failed", error: String(error) })
        }
        addAttempt(receipt, attempt)
        await appendLive(root, {
          event: "kane.end",
          loopID: state.loopID,
          status: result.status,
          credits: result.credits,
          durationS: result.durationS,
          steps: result.steps,
          members: result.members.map((m) => ({ name: m.name, status: m.status, failure: m.failure })),
          verdict: result.verdict,
        })

        if (decision.action === "green") {
          receipt.outcome = "green"
          state.outcome = "green"
          state.awaitingFix = false
          const written = await finalize(state, receipt, decision.message)
          return { receipt, result, receiptPath: written.jsonPath, message: decision.message }
        }

        if (decision.action === "stop") {
          receipt.outcome = decision.outcome
          state.outcome = decision.outcome
          state.awaitingFix = false
          if (result.status === "failed") {
            receipt.notes?.push(`Last red: ${result.members.filter((m) => m.status !== "passed").map((m) => m.name).join(", ")}`)
          }
          const written = await finalize(state, receipt, decision.message)
          return { receipt, result, receiptPath: written.jsonPath, message: decision.message }
        }

        // Red: hand the brief back to the agent in the same session.
        receipt.outcome = "red"
        state.outcome = "red"
        state.awaitingFix = true
        receipt.endedAt = new Date().toISOString()
        const written = await writeReceipt(root, config.receiptsDir, receipt)
        await appendLive(root, {
          event: "loop.red",
          loopID: state.loopID,
          attempt: state.attempts,
          receipt: written.jsonPath,
          failed: result.members.filter((m) => m.status !== "passed").map((m) => m.name),
        })
        try {
          await ctx.session.prompt({ sessionID, text: decision.message })
        } catch (error) {
          await appendLive(root, { event: "prompt.failed", error: String(error) })
        }
        return { receipt, result, receiptPath: written.jsonPath, message: decision.message }
      } finally {
        state.inFlight = false
      }
    }

    // --- Track app edits so a turn boundary knows whether anything changed.
    await ctx.tool.hook("execute.after", async (event) => {
      if (!EDIT_TOOLS.has(event.tool)) return
      const input = event.input as { path?: string; file_path?: string } | undefined
      const repoPath = toRepoPath(input?.path ?? input?.file_path)
      if (!repoPath) return
      if (matchesAny(repoPath, config.app.editGlobs)) {
        const state = stateFor(event.sessionID)
        state.dirty.add(repoPath)
        state.outcome = undefined
        await appendLive(root, { event: "app.edit", sessionID: event.sessionID, path: repoPath })
      }
    })

    // --- Trigger 2: the agent's turn ended.
    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          if (event.type !== "session.execution.succeeded") continue
          const sessionID = (event.data as { sessionID?: string } | undefined)?.sessionID
          if (!sessionID) continue
          const state = states.get(sessionID)
          if (!state || state.inFlight) continue

          const verdict = shouldAutoVerify(state, config, state.dirty.size)
          await appendLive(root, {
            event: "turn.ended",
            sessionID,
            run: verdict.run,
            reason: verdict.reason,
            dirty: [...state.dirty],
          })

          if (!verdict.run) {
            if (state.awaitingFix && state.dirty.size === 0 && state.lastStatus === "failed") {
              state.awaitingFix = false
              state.outcome = "stalled"
              await say(
                sessionID,
                "GREENLIGHT: the last run was red but no app file changed, so Kane was not run again (saved the credits). Call greenlight_verify when you have a fix.",
              )
            }
            continue
          }

          state.awaitingFix = false
          await verify(
            sessionID,
            { reason: state.objective },
            { kind: "auto", files: [...state.dirty], reason: verdict.reason },
          )
        }
      } catch (error) {
        await appendLive(root, { event: "subscription.ended", error: String(error) })
      }
    })()

    // --- Trigger 1: an explicit tool call, usable from any agent.
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "greenlight_verify",
        description:
          "Run the Kane CLI suite against the running app and return a Loop Receipt. " +
          "Use after changing app code: green means Kane verified it, red means read the Failure Brief and fix the app. " +
          "Never edit flows/**, recordings, or the plugin to make this pass.",
        input: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Why you are verifying, in one line." },
            objective: {
              type: "string",
              description:
                "Optional: run one kane-cli objective instead of the committed flow suite (e.g. a smoke check).",
            },
          },
          additionalProperties: false,
        },
        execute: async (input: VerifyInput, context: { sessionID: string }) => {
          const { receipt, receiptPath, message } = await verify(
            context.sessionID,
            input ?? {},
            { kind: "tool", files: [], reason: input?.reason },
          )
          const body = [
            message,
            "",
            renderReceiptMarkdown(receipt),
            receiptPath ? `Receipt: ${receiptPath}` : "",
          ]
            .filter(Boolean)
            .join("\n")
          return {
            content: body,
            metadata: {
              outcome: receipt.outcome,
              attempt: receipt.attempts.length,
              credits: receipt.totals.credits,
              receipt: receiptPath,
            },
          }
        },
      })
    })

    return () => controller.abort()
  },
})
