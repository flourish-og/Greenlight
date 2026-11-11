/**
 * Integrity guard.
 *
 * A red run is only useful if the agent fixes the app. If the agent instead
 * edits the test, the recording, or the plugin, the "green" would be a lie.
 * Before every verification we hash the protected files; after the agent's turn
 * we hash them again and refuse to run Kane on a mismatch.
 */
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { matchesAny } from "./glob.ts"

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".greenlight",
  ".testmuai",
  ".turbo",
  "coverage",
])

export type Snapshot = Record<string, string>

export function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

export function snapshot(root: string, globs: readonly string[]): Snapshot {
  const out: Snapshot = {}
  const walk = (dir: string) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(full)
      } else if (stat.isFile()) {
        const rel = relative(root, full).replaceAll("\\", "/")
        if (globs.length === 0 || matchesAny(rel, globs)) out[rel] = hashFile(full)
      }
    }
  }
  walk(root)
  return out
}

export function diffSnapshots(before: Snapshot, after: Snapshot): string[] {
  const changed = new Set<string>()
  for (const [path, hash] of Object.entries(after)) {
    if (before[path] !== hash) changed.add(path)
  }
  for (const path of Object.keys(before)) {
    if (!(path in after)) changed.add(path)
  }
  return [...changed].sort()
}
