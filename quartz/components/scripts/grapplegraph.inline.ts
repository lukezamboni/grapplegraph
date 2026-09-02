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

function buildRequirementProgress() {
  const slug = document.body.dataset.slug?.replace(/^\/+|\/+$/g, "") ?? ""
  const article = document.querySelector<HTMLElement>("article.technique-card")
  if (!slug.startsWith("techniques/") || !article) return

  let control = article.querySelector<HTMLElement>(".technique-progress-control")
  if (!control) {
    control = document.createElement("section")
    control.className = "technique-progress-control"
    control.setAttribute("aria-label", "Requirement progress")
    control.innerHTML = `
      <div class="technique-progress-copy">
        <p class="eyebrow">MY PROGRESS</p>
        <strong>Practice status</strong>
        <small>Saved only in this browser</small>
      </div>
      <button class="technique-progress-toggle" type="button"></button>`
    article.prepend(control)

    control
      .querySelector<HTMLButtonElement>(".technique-progress-toggle")!
      .addEventListener("click", () => {
        const progress = readProgress()
        const next = cycleState(progress[slug])
        if (next) progress[slug] = next
        else delete progress[slug]
        saveProgress(progress)
        buildRequirementProgress()
      })
  }

  const state = readProgress()[slug]
  control.dataset.state = state ?? "not-started"
  const button = control.querySelector<HTMLButtonElement>(".technique-progress-toggle")!
  const label = stateLabel(state)
  button.dataset.state = state ?? "not-started"
  button.title = `${label}. Click to change status.`
  button.setAttribute("aria-label", `${label}. Click to change status.`)
  button.innerHTML = `<span aria-hidden="true">${statusIcon(state)}</span><strong>${label}</strong>`
}

function configureExpandedGraph() {
  document.querySelectorAll<HTMLElement>(".graph").forEach((graphRoot) => {
    const localGraph = graphRoot.querySelector<HTMLElement>(".graph-container")
    const globalGraph = graphRoot.querySelector<HTMLElement>(".global-graph-container")
    const overlay = graphRoot.querySelector<HTMLElement>(".global-graph-outer")
    const sourceFilters = graphRoot.querySelector<HTMLElement>(":scope > .graph-filters")
    if (!localGraph || !globalGraph || !overlay || !sourceFilters) return

    try {
      const localConfig = JSON.parse(localGraph.dataset.cfg ?? "{}") as { depth?: number }
      const globalConfig = JSON.parse(globalGraph.dataset.cfg ?? "{}") as Record<string, unknown>
      const slug = document.body.dataset.slug?.replace(/^\/+|\/+$/g, "") ?? "index"
      globalGraph.dataset.cfg = JSON.stringify({
        ...globalConfig,
        depth: slug === "index" ? -1 : (localConfig.depth ?? 1),
      })
    } catch {
      // Leave the plugin configuration intact if a third-party option is malformed.
    }

    if (overlay.querySelector(".global-graph-toolbar")) return

    const toolbar = document.createElement("div")
    toolbar.className = "global-graph-toolbar"
    toolbar.addEventListener("click", (event) => event.stopPropagation())

    const heading = document.createElement("div")
    heading.className = "global-graph-heading"
    const pageTitle = document.querySelector<HTMLElement>(".article-title")?.textContent?.trim()
    heading.innerHTML = `<p class="eyebrow">EXPANDED TECHNIQUE MAP</p><strong></strong><small></small>`
    heading.querySelector("strong")!.textContent = pageTitle || "Complete atlas"

    const modalCount = heading.querySelector("small")!
    const localCount = graphRoot.querySelector<HTMLElement>(".graph-filter-count")
    const updateCount = () => {
      modalCount.textContent = localCount?.textContent || "Current filters"
    }
    updateCount()
    if (localCount) {
      new MutationObserver(updateCount).observe(localCount, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    }

    const filters = sourceFilters.cloneNode(true) as HTMLElement
    filters.classList.add("global-graph-filters")
    filters.querySelectorAll<HTMLSelectElement>("[data-graph-filter]").forEach((clone) => {
      const name = clone.dataset.graphFilter
      const original = sourceFilters.querySelector<HTMLSelectElement>(
        `[data-graph-filter="${name}"]`,
      )
      if (!original) return
      clone.value = original.value
      original.addEventListener("change", () => {
        clone.value = original.value
      })
      clone.addEventListener("change", () => {
        original.value = clone.value
        original.dispatchEvent(new Event("change", { bubbles: true }))
        window.setTimeout(() => {
          const theme: "light" | "dark" =
            document.documentElement.getAttribute("saved-theme") === "dark" ? "dark" : "light"
          document.dispatchEvent(
            new CustomEvent<{ theme: "light" | "dark" }>("themechange", { detail: { theme } }),
          )
        }, 0)
      })
    })

    const close = document.createElement("button")
    close.className = "global-graph-close"
    close.type = "button"
    close.setAttribute("aria-label", "Close expanded technique map")
    close.textContent = "×"
    close.addEventListener("click", () => {
      graphRoot.querySelector<HTMLButtonElement>(".global-graph-icon")?.click()
    })

    toolbar.append(heading, filters, close)
    overlay.prepend(toolbar)
  })
}

let canvasObservers: ResizeObserver[] = []

function disconnectCanvasObservers() {
  canvasObservers.forEach((observer) => observer.disconnect())
  canvasObservers = []
}

function configureResponsiveCanvases() {
  if (typeof ResizeObserver === "undefined") return

  document.querySelectorAll<HTMLElement>(".canvas-container").forEach((container) => {
    if (container.dataset.responsiveFit === "true") return
    container.dataset.responsiveFit = "true"

    let previousWidth = container.clientWidth
    let previousHeight = container.clientHeight
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (Math.abs(width - previousWidth) < 2 && Math.abs(height - previousHeight) < 2) return
      previousWidth = width
      previousHeight = height
      window.requestAnimationFrame(() => {
        container.querySelector<HTMLButtonElement>(".canvas-reset-view")?.click()
      })
    })
    observer.observe(container)
    canvasObservers.push(observer)
  })
}

function schedulePageEnhancements() {
  window.setTimeout(() => {
    buildRequirementProgress()
    configureExpandedGraph()
    configureResponsiveCanvases()
  }, 0)
}

document.addEventListener("nav", () => {
  buildExamTracker()
  normalizeStackedPagesAfterNavigation()
  schedulePageEnhancements()
})
document.addEventListener("render", () => {
  normalizeStackedPagesAfterNavigation()
  schedulePageEnhancements()
})
document.addEventListener("prenav", disconnectCanvasObservers)
window.addEventListener("grapplegraph-progress", buildRequirementProgress)
buildExamTracker()
normalizeStackedPagesAfterNavigation()
schedulePageEnhancements()
