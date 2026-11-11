import { defineConfig } from "vite"
import type { Connect, Plugin, ViteDevServer } from "vite"
import react from "@vitejs/plugin-react"
import { handleApi } from "./server/api.mjs"

/** Dev server = Vite UI + the same read-only API the production server uses. */
function apiPlugin(): Plugin {
  return {
    name: "greenlight-board-api",
    configureServer(server: ViteDevServer) {
      const middleware: Connect.NextHandleFunction = async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost")
        if (!url.pathname.startsWith("/api/")) return next()
        const body = await handleApi(url.pathname, url.searchParams)
        if (body === undefined) return next()
        res.setHeader("content-type", "application/json; charset=utf-8")
        res.setHeader("cache-control", "no-store")
        res.end(JSON.stringify(body))
      }
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
})
