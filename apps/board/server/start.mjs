import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join, resolve } from "node:path"
import { handleApi, repoRoot } from "./api.mjs"

const root = repoRoot()
const dist = resolve(process.cwd(), "dist")
const port = Number(process.env.PORT ?? 5174)
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
}

async function sendFile(res, path) {
  try {
    const body = await readFile(path)
    res.setHeader("content-type", types[extname(path)] ?? "application/octet-stream")
    res.end(body)
    return true
  } catch {
    return false
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  if (url.pathname.startsWith("/api/")) {
    const body = await handleApi(url.pathname, url.searchParams, root)
    if (body === undefined) {
      res.statusCode = 404
      res.end(JSON.stringify({ error: "not found" }))
      return
    }
    res.setHeader("content-type", "application/json; charset=utf-8")
    res.setHeader("cache-control", "no-store")
    res.end(JSON.stringify(body))
    return
  }
  const safe = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "")
  if (!safe.includes("..") && (await sendFile(res, join(dist, safe)))) return
  if (!(await sendFile(res, join(dist, "index.html")))) {
    res.statusCode = 404
    res.end("Build the board first: pnpm --dir apps/board build")
  }
}).listen(port, () => {
  console.log(`Loop Board on http://localhost:${port} (repo ${root})`)
})
