/**
 * GREENLIGHT config: one committed JSON file per repo, with safe defaults.
 *
 * Everything the loop needs to know about *this* app lives here, so the plugin
 * stays reusable: point `app.startUrl` at any dev server and `flows.match` at
 * any Kane test suite.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

export interface GreenlightConfig {
  app: {
    /** The URL Kane should open. Also the dev-server health probe. */
    startUrl: string
    /** Command that starts the dev server, run from the repo root. */
    devCommand: string
    /** Files whose edits count as "the agent changed the app". */
    editGlobs: string[]
    devServer: {
      /** Start the dev server when it is not reachable. */
      autoStart: boolean
      /** How long to wait for it to answer before giving up. */
      timeoutMs: number
    }
  }
  flows: {
    /** Regex handed to `testrun run --match`. */
    match: string
    /** Seconds a single Kane run may take before the plugin kills it. */
    timeoutMs: number
  }
  loop: {
    /** Run Kane automatically when the agent edits app code. */
    auto: boolean
    /** Verification passes per user request before the loop stops. */
    maxIterations: number
    /** Stop the loop if a single verification costs more than this. */
    maxCreditsPerLoop: number
    /** Stop the loop if the session as a whole costs more than this. */
    maxCreditsPerSession: number
  }
  integrity: {
    /** Files the agent must not touch to make a run go green. */
    protect: string[]
    /** Allow edits to protected files (they are still recorded in the receipt). */
    allowFlowEdits: boolean
  }
  /** Directory for Loop Receipts, relative to the repo root. */
  receiptsDir: string
}

export const DEFAULT_CONFIG: GreenlightConfig = {
  app: {
    startUrl: "http://localhost:5173",
    devCommand: "pnpm --dir apps/store dev",
    editGlobs: ["apps/store/src/**", "apps/store/index.html", "apps/board/src/**"],
    devServer: { autoStart: true, timeoutMs: 90_000 },
  },
  flows: {
    match: "^flows[/\\\\]store[/\\\\]",
    timeoutMs: 900_000,
  },
  loop: {
    auto: true,
    maxIterations: 3,
    maxCreditsPerLoop: 80,
    maxCreditsPerSession: 200,
  },
  integrity: {
    protect: [
      "flows/**/*_test.md",
      "greenlight.config.json",
      "package.json",
      "apps/store/package.json",
      ".opencode/plugins/**/*.ts",
    ],
    allowFlowEdits: false,
  },
  receiptsDir: ".greenlight/receipts",
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Recursive merge: user values win, arrays are replaced wholesale. */
export function mergeConfig<T>(base: T, override: unknown): T {
  if (!isPlainObject(override) || !isPlainObject(base)) return (override ?? base) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const current = (base as Record<string, unknown>)[key]
    out[key] = isPlainObject(value) && isPlainObject(current) ? mergeConfig(current, value) : value
  }
  return out as T
}

export const CONFIG_FILE = "greenlight.config.json"

export function loadConfig(root: string): GreenlightConfig {
  try {
    const raw = readFileSync(join(root, CONFIG_FILE), "utf8")
    return mergeConfig(DEFAULT_CONFIG, JSON.parse(raw))
  } catch {
    return DEFAULT_CONFIG
  }
}
