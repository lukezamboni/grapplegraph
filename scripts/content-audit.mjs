import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import YAML from "yaml"

const root = process.cwd()
const contentRoot = path.join(root, "content")
const techniqueRoot = path.join(contentRoot, "techniques")
const conceptRoots = ["positions", "movements", "submissions"]
const errors = []
const warnings = []

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? markdownFiles(full) : entry.name.endsWith(".md") ? [full] : []
  })
}

function readNote(file) {
  const source = fs.readFileSync(file, "utf8")
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { data: {}, body: source }
  return { data: YAML.parse(match[1]) ?? {}, body: match[2] }
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/")
}

function report(target, message, severity = "error") {
  ;(severity === "error" ? errors : warnings).push(`${relative(target)}: ${message}`)
}

const techniqueFiles = markdownFiles(techniqueRoot).filter(
  (file) => path.basename(file) !== "index.md",
)
const techniques = techniqueFiles.map((file) => ({ file, ...readNote(file) }))
const belts = new Map([
  ["blue", techniques.filter((note) => note.data.belt === "blue")],
  ["purple", techniques.filter((note) => note.data.belt === "purple")],
  ["brown-only", techniques.filter((note) => note.data.belt === "brown-only")],
])
const expectedCounts = { blue: 30, purple: 27, "brown-only": 3 }
const expectedPrefixes = { blue: "BLU", purple: "PUR", "brown-only": "BRO" }

for (const [belt, notes] of belts) {
  if (notes.length !== expectedCounts[belt]) {
    errors.push(`${belt}: expected ${expectedCounts[belt]} requirements, found ${notes.length}`)
  }

  const ids = notes.map((note) => Number(note.data.exam_id)).sort((a, b) => a - b)
  const expectedIds = Array.from({ length: expectedCounts[belt] }, (_, index) => index + 1)
  if (ids.join(",") !== expectedIds.join(",")) {
    errors.push(
      `${belt}: exam_id values must be contiguous 1-${expectedCounts[belt]}; found ${ids.join(", ")}`,
    )
  }

  for (const note of notes) {
    const id = String(note.data.exam_id).padStart(2, "0")
    const required = [
      "title",
      "description",
      "tags",
      "cssclasses",
      "exam_id",
      "source_exam_id",
      "belt",
      "family",
      "start",
      "landing",
      "finish",
      "video_match",
      "instructor_verified",
    ]
    for (const key of required) {
      if (note.data[key] === undefined || note.data[key] === null || note.data[key] === "") {
        report(note.file, `missing frontmatter field "${key}"`)
      }
    }

    if (!String(note.data.title ?? "").startsWith(`${expectedPrefixes[belt]}-${id} · `)) {
      report(note.file, `title must start with ${expectedPrefixes[belt]}-${id} ·`)
    }

    const tags = Array.isArray(note.data.tags) ? note.data.tags : []
    const familyTag = tags.find((tag) => String(tag).startsWith("family/"))
    if (familyTag && familyTag !== `family/${note.data.family}`) {
      report(note.file, `family field "${note.data.family}" disagrees with tag "${familyTag}"`)
    }

    for (const heading of ["Sequence", "Study card", "Key cues", "Practice", "Video study"]) {
      if (!new RegExp(`^#{2,3} ${heading}$`, "m").test(note.body)) {
        report(note.file, `missing "${heading}" section`)
      }
    }

    if (!/https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/.test(note.body)) {
      report(note.file, "missing a direct YouTube watch URL")
    }
  }
}

const purpleSourceIds = belts
  .get("purple")
  .map((note) => Number(note.data.source_exam_id))
  .sort((a, b) => a - b)
const brownSourceIds = belts
  .get("brown-only")
  .map((note) => Number(note.data.source_exam_id))
  .sort((a, b) => a - b)
const expectedPurpleSourceIds = [...Array(30).keys()]
  .map((index) => index + 1)
  .filter((id) => ![10, 12, 18].includes(id))
if (purpleSourceIds.join(",") !== expectedPurpleSourceIds.join(",")) {
  errors.push("purple: source_exam_id values do not match the academy sheet")
}
if (brownSourceIds.join(",") !== "10,12,18") {
  errors.push("brown-only: source_exam_id values must be 10, 12, and 18")
}

const allNotes = markdownFiles(contentRoot)
const slugs = new Set(
  allNotes.map((file) =>
    path
      .relative(contentRoot, file)
      .replaceAll("\\", "/")
      .replace(/\.md$/, "")
      .replace(/\/index$/, ""),
  ),
)
const positionSlugs = new Set(
  markdownFiles(path.join(contentRoot, "positions"))
    .filter((file) => path.basename(file) !== "index.md")
    .map((file) => path.basename(file, ".md")),
)
const submissionSlugs = new Set(
  markdownFiles(path.join(contentRoot, "submissions"))
    .filter((file) => path.basename(file) !== "index.md")
    .map((file) => path.basename(file, ".md")),
)

for (const note of techniques) {
  if (!positionSlugs.has(String(note.data.start))) {
    report(note.file, `start "${note.data.start}" does not identify a position note`)
  }
  if (
    !positionSlugs.has(String(note.data.landing)) &&
    !submissionSlugs.has(String(note.data.landing))
  ) {
    report(
      note.file,
      `landing "${note.data.landing}" does not identify a position or submission-control note`,
    )
  }
  const finish = String(note.data.finish)
  if (
    !submissionSlugs.has(finish) &&
    !positionSlugs.has(finish) &&
    !["escape", "positional-control"].includes(finish)
  ) {
    report(
      note.file,
      `finish "${finish}" does not identify a submission, position, or approved outcome`,
    )
  }
}

for (const file of allNotes) {
  const { body } = readNote(file)
  for (const match of body.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)) {
    const target = match[1].replace(/^\//, "")
    if (target.startsWith("tags/") || /\.(?:base|canvas)$/.test(target)) continue
    const resolved = target.startsWith(".")
      ? path.posix.normalize(
          path.posix.join(
            path.dirname(path.relative(contentRoot, file).replaceAll("\\", "/")),
            target,
          ),
        )
      : target
    if (!slugs.has(resolved)) report(file, `unresolved wikilink "${match[1]}"`)
  }
}

for (const folder of conceptRoots) {
  const files = markdownFiles(path.join(contentRoot, folder)).filter(
    (file) => path.basename(file) !== "index.md",
  )
  for (const file of files) {
    const note = readNote(file)
    if (!note.data.title) report(file, "missing title")
    if (!note.data.description) report(file, "missing description")
    if (!/^## Video study$/m.test(note.body)) report(file, 'missing "## Video study" section')
    if (!/https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/.test(note.body)) {
      report(file, "missing a direct YouTube watch URL")
    }
  }
}

if (warnings.length) {
  console.warn(
    `Content audit warnings (${warnings.length}):\n${warnings.map((line) => `- ${line}`).join("\n")}`,
  )
}

if (errors.length) {
  console.error(
    `Content audit failed (${errors.length}):\n${errors.map((line) => `- ${line}`).join("\n")}`,
  )
  process.exit(1)
}

console.log(
  `Content audit passed: ${techniques.length} requirements and ${allNotes.length} Markdown notes checked.`,
)
