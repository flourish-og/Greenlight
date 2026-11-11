import assert from "node:assert/strict"
import { test } from "node:test"
import { globToRegExp, matchesAny } from "../../.opencode/plugins/greenlight/glob.ts"

test("`**/` matches zero or more directories", () => {
  const pattern = globToRegExp("flows/**/*_test.md")
  assert.ok(pattern.test("flows/store/cart_test.md"))
  assert.ok(pattern.test("flows/cart_test.md"))
  assert.ok(pattern.test("flows/a/b/c_test.md"))
})

test("protected flow glob does not match recordings or source", () => {
  const globs = ["flows/**/*_test.md"]
  assert.ok(matchesAny("flows/store/promo_test.md", globs))
  assert.ok(!matchesAny("flows/store/cart.md", globs))
  assert.ok(!matchesAny("flows/store/output-cart/.internal/steps/1-abc/plan.json", globs))
  assert.ok(!matchesAny("apps/store/src/App.tsx", globs))
})

test("bare `**` spans separators, `*` does not", () => {
  assert.ok(globToRegExp("apps/store/src/**").test("apps/store/src/App.tsx"))
  assert.ok(globToRegExp("apps/store/src/**").test("apps/store/src/ui/Cart.tsx"))
  assert.ok(globToRegExp("*.ts").test("index.ts"))
  assert.ok(!globToRegExp("*.ts").test("src/index.ts"))
})

test("`?` matches exactly one non-separator character", () => {
  const pattern = globToRegExp("step-?.json")
  assert.ok(pattern.test("step-1.json"))
  assert.ok(!pattern.test("step-10.json"))
  assert.ok(!pattern.test("step-/json"))
})

test("regex metacharacters in globs are literal", () => {
  assert.ok(globToRegExp("apps/store/package.json").test("apps/store/package.json"))
  assert.ok(!globToRegExp("apps/store/package.json").test("apps/store/packageXjson"))
  assert.ok(globToRegExp("a+b(c).txt").test("a+b(c).txt"))
})

test("matchesAny normalizes Windows separators and is anchored", () => {
  assert.ok(matchesAny("apps\\store\\src\\App.tsx", ["apps/store/src/**"]))
  assert.ok(!matchesAny("x/apps/store/src/App.tsx", ["apps/store/src/**"]))
  assert.ok(!matchesAny("apps/store/src/App.tsx.bak", ["apps/store/src/*.tsx"]))
})

test("empty glob list matches nothing through matchesAny", () => {
  assert.equal(matchesAny("anything", []), false)
})
