import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { DEFAULT_CONFIG, loadConfig, mergeConfig } from "../../.opencode/plugins/greenlight/config.ts"

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)))

test("the committed config is exactly the documented default", () => {
  assert.deepEqual(loadConfig(repoRoot), DEFAULT_CONFIG)
})

test("the committed flow match selects only the store suite", () => {
  const { match } = loadConfig(repoRoot).flows
  const regex = new RegExp(match)
  assert.ok(regex.test("flows/store/cart_test.md"))
  assert.ok(regex.test("flows\\store\\catalog_test.md"))
  assert.ok(!regex.test("flows/other/cart_test.md"))
  assert.ok(!regex.test("apps/store/src/App.tsx"))
})

test("a missing config file falls back to defaults", () => {
  const dir = mkdtempSync(join(tmpdir(), "gl-config-"))
  try {
    assert.deepEqual(loadConfig(dir), DEFAULT_CONFIG)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("partial configs merge deeply and replace arrays wholesale", () => {
  const dir = mkdtempSync(join(tmpdir(), "gl-config-"))
  try {
    writeFileSync(
      join(dir, "greenlight.config.json"),
      JSON.stringify({
        app: { startUrl: "http://localhost:9999" },
        loop: { auto: false },
        integrity: { protect: ["flows/**/*_test.md"] },
      }),
    )
    const config = loadConfig(dir)
    assert.equal(config.app.startUrl, "http://localhost:9999")
    assert.equal(config.app.devCommand, DEFAULT_CONFIG.app.devCommand)
    assert.equal(config.app.devServer.timeoutMs, DEFAULT_CONFIG.app.devServer.timeoutMs)
    assert.equal(config.loop.auto, false)
    assert.equal(config.loop.maxIterations, DEFAULT_CONFIG.loop.maxIterations)
    assert.deepEqual(config.integrity.protect, ["flows/**/*_test.md"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("mergeConfig ignores prototype-ish junk and keeps the base", () => {
  const merged = mergeConfig({ a: 1, b: { c: 2 } }, null)
  assert.deepEqual(merged, { a: 1, b: { c: 2 } })
  assert.deepEqual(mergeConfig({ a: 1 }, "nonsense"), "nonsense")
})
