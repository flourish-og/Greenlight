import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { diffSnapshots, hashFile, snapshot } from "../../.opencode/plugins/greenlight/integrity.ts"

const roots: string[] = []

function fixtureTree(): string {
  const root = mkdtempSync(join(tmpdir(), "gl-integrity-"))
  roots.push(root)
  mkdirSync(join(root, "flows", "store", "output-cart"), { recursive: true })
  mkdirSync(join(root, "apps", "store", "src"), { recursive: true })
  mkdirSync(join(root, "node_modules", "junk"), { recursive: true })
  mkdirSync(join(root, ".greenlight"), { recursive: true })
  writeFileSync(join(root, "flows", "store", "cart_test.md"), "step 1\n")
  writeFileSync(join(root, "flows", "store", "output-cart", "plan.json"), "{}\n")
  writeFileSync(join(root, "apps", "store", "src", "App.tsx"), "export {}\n")
  writeFileSync(join(root, "node_modules", "junk", "index.js"), "junk\n")
  writeFileSync(join(root, ".greenlight", "live.ndjson"), "{}\n")
  return root
}

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

test("snapshot hashes only protected files and skips noisy directories", () => {
  const root = fixtureTree()
  const snap = snapshot(root, ["flows/**/*_test.md", "apps/store/src/**"])
  assert.deepEqual(Object.keys(snap).sort(), ["apps/store/src/App.tsx", "flows/store/cart_test.md"])
  for (const hash of Object.values(snap)) assert.match(hash, /^[0-9a-f]{64}$/)
})

test("snapshot with no globs hashes everything except skipped directories", () => {
  const root = fixtureTree()
  const snap = snapshot(root, [])
  assert.ok(!("node_modules/junk/index.js" in snap))
  assert.ok(!(".greenlight/live.ndjson" in snap))
  assert.ok("flows/store/output-cart/plan.json" in snap)
})

test("editing a protected file shows up as drift", () => {
  const root = fixtureTree()
  const globs = ["flows/**/*_test.md"]
  const before = snapshot(root, globs)
  writeFileSync(join(root, "flows", "store", "cart_test.md"), "step 1 edited to pass\n")
  const after = snapshot(root, globs)
  assert.deepEqual(diffSnapshots(before, after), ["flows/store/cart_test.md"])
})

test("delete and add are both drift, unchanged trees are not", () => {
  const root = fixtureTree()
  const globs = ["flows/**/*_test.md"]
  const before = snapshot(root, globs)
  assert.deepEqual(diffSnapshots(before, snapshot(root, globs)), [])

  writeFileSync(join(root, "flows", "store", "promo_test.md"), "new flow\n")
  const withNew = snapshot(root, globs)
  assert.deepEqual(diffSnapshots(before, withNew), ["flows/store/promo_test.md"])

  rmSync(join(root, "flows", "store", "cart_test.md"))
  assert.deepEqual(diffSnapshots(before, snapshot(root, globs)), [
    "flows/store/cart_test.md",
    "flows/store/promo_test.md",
  ])
})

test("recording and app-source edits are not protected", () => {
  const root = fixtureTree()
  const globs = ["flows/**/*_test.md", "package.json"]
  const before = snapshot(root, globs)
  writeFileSync(join(root, "flows", "store", "output-cart", "plan.json"), '{"tampered":true}\n')
  writeFileSync(join(root, "apps", "store", "src", "App.tsx"), "export const fixed = true\n")
  assert.deepEqual(diffSnapshots(before, snapshot(root, globs)), [])
})

test("hashFile is stable and content-addressed", () => {
  const root = fixtureTree()
  const path = join(root, "flows", "store", "cart_test.md")
  assert.equal(hashFile(path), hashFile(path))
  writeFileSync(path, "different\n")
  assert.notEqual(hashFile(path), hashFile(join(root, "apps", "store", "src", "App.tsx")))
})
