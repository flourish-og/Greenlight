import { readFile } from "node:fs/promises"
import { resolve, join } from "node:path"

/**
 * The board's whole backend: four read-only endpoints over files the plugin
 * already writes. No database, no websocket - the live view is a tail.
 */
export function repoRoot() {
  return process.env.GREENLIGHT_ROOT ? resolve(process.env.GREENLIGHT_ROOT) : resolve(process.cwd(), "..", "..")
}

async function readText(path) {
  try {
    return await readFile(path, "utf8")
  } catch {
    return undefined
  }
}

function parseLines(text) {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("{"))
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
}

function deriveState(events) {
  let status = "idle"
  let loopID
  let outcome
  for (const event of events) {
    if (event.loopID) loopID = event.loopID
    if (event.event === "verify.start" || event.event === "kane.start") status = "running"
    if (event.event === "loop.red") {
      status = "red"
      outcome = "red"
    }
    if (event.event === "loop.finished") {
      outcome = event.outcome
      status = event.outcome === "green" ? "green" : event.outcome === "integrity_blocked" ? "blocked" : "red"
    }
  }
  return { status, loopID, outcome }
}

export async function listReceipts(root) {
  const text = await readText(join(root, ".greenlight", "receipts", "index.ndjson"))
  const receipts = parseLines(text)
  receipts.sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")))
  return { receipts }
}

export async function getReceipt(root, file) {
  if (!/^[A-Za-z0-9._-]+\.json$/.test(file) || file.includes("..")) return { error: "not found" }
  const text = await readText(join(root, ".greenlight", "receipts", file))
  if (!text) return { error: "not found" }
  try {
    return { receipt: JSON.parse(text) }
  } catch {
    return { error: "not valid JSON" }
  }
}

export async function getLive(root, limit = 80) {
  const text = await readText(join(root, ".greenlight", "live.ndjson"))
  const all = parseLines(text)
  const events = all.slice(-Math.max(1, Math.min(500, Number(limit) || 80)))
  return { events, state: deriveState(all), total: all.length }
}

export async function getReplay(root) {
  const text = await readText(join(root, "fixtures", "recorded", "phase2-loop.json"))
  if (!text) return { error: "no recorded replay" }
  try {
    return { replay: JSON.parse(text) }
  } catch {
    return { error: "recorded replay is not valid JSON" }
  }
}

/** Returns the JSON body, or undefined when the path is not an API route. */
export async function handleApi(pathname, searchParams, root = repoRoot()) {
  if (pathname === "/api/health") return { ok: true, root, now: new Date().toISOString() }
  if (pathname === "/api/live") return getLive(root, searchParams.get("limit"))
  if (pathname === "/api/receipts") return listReceipts(root)
  if (pathname.startsWith("/api/receipts/")) return getReceipt(root, pathname.slice("/api/receipts/".length))
  if (pathname === "/api/replay") return getReplay(root)
  return undefined
}
