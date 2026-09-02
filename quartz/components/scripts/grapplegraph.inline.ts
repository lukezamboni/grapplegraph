type ProgressState = "working" | "done"
type ProgressMap = Record<string, ProgressState>

const progressKey = "grapplegraph-progress-v1"

function readProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(progressKey) ?? "{}") as ProgressMap
  } catch {
    return {}
  }
}

function saveProgress(progress: ProgressMap) {
  localStorage.setItem(progressKey, JSON.stringify(progress))
  window.dispatchEvent(new CustomEvent("grapplegraph-progress"))
}

function cycleState(current?: ProgressState): ProgressState | undefined {
  if (!current) return "working"
  if (current === "working") return "done"
  return undefined
}

function stateLabel(state?: ProgressState) {
  if (state === "working") return "Working on it"
  if (state === "done") return "Done"
  return "Not started"
}

function statusIcon(state?: ProgressState) {
  if (state === "working") return "◐"
  if (state === "done") return "✓"
  return "○"
}

function numericTitle(title: string) {
  const match = title.match(/^(?:[A-Z]{3}-)?(\d+)/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

const stackedPagesKey = "stacked-pages-state"

/**
 * Quartz's stacked-pages plugin stores the full pathname as its slug. On a
 * project Pages site that pathname already includes the base path, so adding
 * the base path again on tab navigation produces /grapplegraph/grapplegraph/.
 * Keep the stored binder slugs relative to the configured site base instead.
 */
function normalizeStackedPageState() {
  const basePath = document.body?.dataset.basepath?.replace(/^\/+|\/+$/g, "")
  if (!basePath) return

  try {
    const raw = sessionStorage.getItem(stackedPagesKey)
    if (!raw) return
    const state = JSON.parse(raw) as {
      tabs?: Array<{ slug?: string; title?: string }>
      activeIndex?: number
    }
    if (!Array.isArray(state.tabs)) return

    let changed = false
    const prefix = `${basePath}/`
    state.tabs = state.tabs.map((tab) => {
      let slug = tab.slug?.replace(/^\/+|\/+$/g, "") ?? "index"
      while (slug.startsWith(prefix)) {
        slug = slug.slice(prefix.length) || "index"
        changed = true
      }
      if (slug === basePath) {
        slug = "index"
        changed = true
      }
      return { ...tab, slug }
    })

    if (changed) sessionStorage.setItem(stackedPagesKey, JSON.stringify(state))
  } catch {
    // Ignore malformed or unavailable session storage and leave navigation usable.
  }
}

function normalizeStackedPagesAfterNavigation() {
  window.setTimeout(normalizeStackedPageState, 0)
}

async function buildExamTracker() {
  const root = document.querySelector<HTMLElement>("#exam-tracker")
  if (!root || root.dataset.ready === "true") return
  root.dataset.ready = "true"

  const data = (await fetchData) as Record<
    string,
    { title?: string; tags?: string[]; description?: string }
  >
  const entries = Object.entries(data)
    .filter(([slug]) => slug.startsWith("techniques/"))
    .map(([slug, details]) => ({
      slug,
      title: details.title ?? slug,
      tags: details.tags ?? [],
      description: details.description ?? "",
    }))

  const groups = {
    blue: entries.filter((entry) => entry.tags.includes("exam/blue-belt")),
    purple: entries.filter((entry) => entry.tags.includes("exam/purple-belt")),
    brown: entries.filter((entry) => entry.tags.includes("exam/brown-belt-only")),
  }
  Object.values(groups).forEach((group) =>
    group.sort((a, b) => numericTitle(a.title) - numericTitle(b.title)),
  )

  let activeBelt: keyof typeof groups = "blue"
  const shell = document.createElement("div")
  shell.className = "exam-tracker-shell"
  root.replaceChildren(shell)

  const render = () => {
    const progress = readProgress()
    const group = groups[activeBelt]
    const complete = group.filter((entry) => progress[entry.slug] === "done").length
    const working = group.filter((entry) => progress[entry.slug] === "working").length
    const beltLabel =
      activeBelt === "brown"
        ? "Brown-only preview"
        : `${activeBelt[0].toUpperCase()}${activeBelt.slice(1)} belt`

    shell.innerHTML = `
      <div class="tracker-head">
        <div><p class="eyebrow">EXAM REQUIREMENTS</p><h2>${beltLabel}</h2></div>
        <div class="tracker-tabs" role="tablist" aria-label="Belt exam">
          <button data-belt="blue" aria-selected="${activeBelt === "blue"}">Blue <span>${groups.blue.length}</span></button>
          <button data-belt="purple" aria-selected="${activeBelt === "purple"}">Purple <span>${groups.purple.length}</span></button>
          <button data-belt="brown" aria-selected="${activeBelt === "brown"}">Brown-only <span>${groups.brown.length}</span></button>
        </div>
      </div>
      <div class="tracker-summary"><div class="progress-rail"><span style="width:${group.length ? (complete / group.length) * 100 : 0}%"></span></div><p><strong>${complete}/${group.length}</strong> done · ${working} working</p></div>
      <ol class="exam-requirements"></ol>
      <p class="tracker-note">Progress is saved only in this browser. Click the circle to cycle: not started → working → done.</p>`

    shell.querySelectorAll<HTMLButtonElement>("[data-belt]").forEach((button) => {
      button.addEventListener("click", () => {
        activeBelt = button.dataset.belt as keyof typeof groups
        render()
      })
    })

    const list = shell.querySelector<HTMLOListElement>(".exam-requirements")!
    for (const entry of group) {
      const state = progress[entry.slug]
      const item = document.createElement("li")
      item.dataset.state = state ?? "not-started"
      const href = new URL(entry.slug, window.location.href).pathname
      item.innerHTML = `<button class="status-toggle" aria-label="${stateLabel(state)}: ${entry.title}" title="${stateLabel(state)}">${statusIcon(state)}</button><a class="internal" href="${href}"><span>${entry.title}</span><small>${entry.description}</small></a>`
      item.querySelector<HTMLButtonElement>(".status-toggle")!.addEventListener("click", () => {
        const next = cycleState(progress[entry.slug])
        if (next) progress[entry.slug] = next
        else delete progress[entry.slug]
        saveProgress(progress)
        render()
      })
      list.append(item)
    }
  }

  render()
}

document.addEventListener("nav", () => {
  buildExamTracker()
  normalizeStackedPagesAfterNavigation()
})
document.addEventListener("render", normalizeStackedPagesAfterNavigation)
buildExamTracker()
normalizeStackedPagesAfterNavigation()
