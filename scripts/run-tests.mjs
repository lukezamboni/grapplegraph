import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = process.cwd()
const quartzRoot = path.join(root, "quartz")

function findTests(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return findTests(target)
    return entry.name.endsWith(".test.ts") ? [target] : []
  })
}

const tests = findTests(quartzRoot)
if (tests.length === 0) {
  console.error("No Quartz tests were found.")
  process.exit(1)
}

const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"))
const result = spawnSync(process.execPath, [tsxCli, "--test", "--test-concurrency=1", ...tests], {
  cwd: root,
  stdio: "inherit",
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
