import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const publicRoot = path.join(root, "public")
const productionOrigin = "https://lukezamboni.github.io"
const productionBase = "/grapplegraph"
const failures = new Set()

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(target) : [target]
  })
}

if (!fs.existsSync(publicRoot)) {
  console.error("Site audit requires a production build in public/. Run npm run build first.")
  process.exit(1)
}

const files = filesIn(publicRoot)
const relativeFiles = new Set(
  files.map((file) => path.relative(publicRoot, file).replaceAll("\\", "/")),
)
const htmlFiles = files.filter((file) => file.endsWith(".html"))

function routeFor(file) {
  const relative = path.relative(publicRoot, file).replaceAll("\\", "/")
  if (relative === "index.html") return ""
  return relative.replace(/\.html$/, "")
}

function resolvesToOutput(pathname) {
  let target = decodeURIComponent(pathname)
  if (target === productionBase || target === `${productionBase}/`) target = "/"
  else if (target.startsWith(`${productionBase}/`)) target = target.slice(productionBase.length)
  target = target.replace(/^\/+/, "")

  const candidates = target
    ? [target, `${target}.html`, `${target.replace(/\/$/, "")}/index.html`]
    : ["index.html"]
  return candidates.some((candidate) => relativeFiles.has(candidate))
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8")
  const pageUrl = `${productionOrigin}${productionBase}/${routeFor(file)}`

  if (/\.(?:base|canvas)\.html$/.test(file) && html.includes("No description provided")) {
    failures.add(`${path.relative(root, file)}: generated page is missing a useful description`)
  }

  const pageTitleHref = html.match(/<h2 class="[^"]*page-title[^"]*"><a href="([^"]+)"/)?.[1]
  if (pageTitleHref) {
    const pageTitleUrl = new URL(pageTitleHref, pageUrl)
    if (
      pageTitleUrl.origin !== productionOrigin ||
      pageTitleUrl.pathname !== `${productionBase}/`
    ) {
      failures.add(
        `${path.relative(root, file)}: GrappleGraph title resolves to "${pageTitleUrl.pathname}" instead of "${productionBase}/"`,
      )
    }
  }

  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const reference = match[1].replaceAll("&amp;", "&")
    if (/^(?:#|data:|mailto:|tel:|javascript:)/i.test(reference)) continue

    let url
    try {
      url = new URL(reference, pageUrl)
    } catch {
      failures.add(`${path.relative(root, file)}: invalid URL "${reference}"`)
      continue
    }

    if (url.origin !== productionOrigin) continue
    if (!resolvesToOutput(url.pathname)) {
      failures.add(`${path.relative(root, file)}: unresolved asset or page "${reference}"`)
    }
  }
}

for (const file of files.filter((candidate) => candidate.endsWith(".js"))) {
  const source = fs.readFileSync(file, "utf8")
  if (/cdn\.jsdelivr\.net\/npm\/(?:d3|pixi)/.test(source)) {
    failures.add(`${path.relative(root, file)}: graph runtime still depends on an unpinned CDN`)
  }
}

if (failures.size > 0) {
  console.error(
    `Site audit failed (${failures.size}):\n${[...failures].map((line) => `- ${line}`).join("\n")}`,
  )
  process.exit(1)
}

console.log(
  `Site audit passed: ${htmlFiles.length} pages and ${relativeFiles.size} output files checked.`,
)
