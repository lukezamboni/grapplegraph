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

const techniqueBeltFolders = new Set(["blue-belt", "purple-belt", "brown-belt-only"])

function legacyTechniqueSlug(slug: string) {
  const parts = slug.split("/")
  if (parts.length !== 3 || parts[0] !== "techniques" || !techniqueBeltFolders.has(parts[1])) {
    return undefined
  }
  return `techniques/${parts[2]}`
}

function migrateTechniqueProgress(progress: ProgressMap, slugs: string[]) {
  let changed = false
  for (const slug of slugs) {
    const legacySlug = legacyTechniqueSlug(slug)
    if (!legacySlug || !progress[legacySlug]) continue
    progress[slug] ??= progress[legacySlug]
    delete progress[legacySlug]
    changed = true
  }
  if (changed) localStorage.setItem(progressKey, JSON.stringify(progress))
  return progress
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

type StackedPageTab = { slug: string; title: string }
type StackedPageState = { tabs: StackedPageTab[]; activeIndex: number }

/**
 * Quartz's stacked-pages plugin stores the full pathname as its slug. On a
 * project Pages site that pathname already includes the base path, so adding
 * the base path again on tab navigation produces /grapplegraph/grapplegraph/.
 * Keep stored binder slugs relative to the configured site base and collapse
 * any full-path/relative-path duplicates into one tab.
 */
function readNormalizedStackedPageState(): StackedPageState | undefined {
  try {
    const raw = sessionStorage.getItem(stackedPagesKey)
    if (!raw) return undefined
    const stored = JSON.parse(raw) as Partial<StackedPageState>
    if (!Array.isArray(stored.tabs)) return undefined

    const basePath = document.body?.dataset.basepath?.replace(/^\/+|\/+$/g, "") ?? ""
    const prefix = basePath ? `${basePath}/` : ""
    const tabs: StackedPageTab[] = []
    let activeIndex = -1

    stored.tabs.forEach((tab, index) => {
      let slug = tab.slug?.replace(/^\/+|\/+$/g, "") || "index"
      while (prefix && slug.startsWith(prefix)) slug = slug.slice(prefix.length) || "index"
      if (basePath && slug === basePath) slug = "index"

      let canonicalIndex = tabs.findIndex((candidate) => candidate.slug === slug)
      if (canonicalIndex === -1) {
        tabs.push({ slug, title: tab.title || slug })
        canonicalIndex = tabs.length - 1
      } else if (index === stored.activeIndex && tab.title) {
        tabs[canonicalIndex].title = tab.title
      }

      if (index === stored.activeIndex) activeIndex = canonicalIndex
    })

    if (tabs.length === 0) activeIndex = -1
    else if (activeIndex < 0) activeIndex = Math.min(stored.activeIndex ?? 0, tabs.length - 1)

    const state = { tabs, activeIndex }
    if (JSON.stringify(stored) !== JSON.stringify(state)) {
      sessionStorage.setItem(stackedPagesKey, JSON.stringify(state))
    }
    return state
  } catch {
    // Ignore malformed or unavailable session storage and leave navigation usable.
    return undefined
  }
}

function saveStackedPageState(state: StackedPageState) {
  sessionStorage.setItem(stackedPagesKey, JSON.stringify(state))
}

function navigateToStackedPage(tab: StackedPageTab) {
  const basePath = document.body?.dataset.basepath?.replace(/\/+$/g, "") ?? ""
  const path = tab.slug === "index" ? `${basePath}/` : `${basePath}/${tab.slug}`
  const url = new URL(path || "/", window.location.origin)
  if (window.spaNavigate) window.spaNavigate(url, false)
  else window.location.href = url.toString()
}

/**
 * The upstream binder splits history around the active page: earlier tabs on
 * the left, later tabs on the right. GrappleGraph uses a conventional, stable
 * left-side strip instead so a tab never appears to jump across the screen.
 */
function renderStackedPages() {
  const container = document.getElementById("stacked-pages-container")
  const state = readNormalizedStackedPageState()
  if (!container || !state) return

  const mobileBreakpoint = Number(container.dataset.mobileBreakpoint || 800)
  if (window.innerWidth < mobileBreakpoint) {
    container.style.display = "none"
    document.body.classList.remove("has-binder-left", "has-binder-right")
    return
  }

  container.style.display = ""
  container.replaceChildren()
  document.body.classList.remove("has-binder-right")
  if (state.tabs.length <= 1) {
    container.classList.remove("binder-active")
    document.body.classList.remove("has-binder-left")
    return
  }

  container.classList.add("binder-active")
  document.body.classList.add("has-binder-left")
  const strip = document.createElement("div")
  strip.className = "binder-strip binder-strip-left"

  state.tabs.forEach((tab, index) => {
    const item = document.createElement("div")
    item.className = "binder-tab binder-tab-left"
    item.dataset.index = String(index)
    item.setAttribute("role", "tab")
    item.setAttribute("aria-selected", String(index === state.activeIndex))
    item.tabIndex = 0
    if (index === state.activeIndex) item.classList.add("binder-tab-active")

    if (container.dataset.showSpines !== "false") {
      const spine = document.createElement("div")
      spine.className = "binder-spine"
      item.appendChild(spine)
    }

    const label = document.createElement("span")
    label.className = "binder-label"
    label.textContent = tab.title
    item.appendChild(label)

    const activate = () => {
      if (index === state.activeIndex) return
      const nextState = readNormalizedStackedPageState()
      if (!nextState?.tabs[index]) return
      nextState.activeIndex = index
      saveStackedPageState(nextState)
      navigateToStackedPage(nextState.tabs[index])
    }
    item.addEventListener("click", activate)
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return
      event.preventDefault()
      activate()
    })

    const close = document.createElement("button")
    close.className = "binder-close"
    close.textContent = "×"
    close.setAttribute("aria-label", `Close ${tab.title}`)
    close.addEventListener("click", (event) => {
      event.stopPropagation()
      const nextState = readNormalizedStackedPageState()
      if (!nextState || nextState.tabs.length < 2) return
      const wasActive = index === nextState.activeIndex
      nextState.tabs.splice(index, 1)
      if (wasActive) nextState.activeIndex = Math.min(index, nextState.tabs.length - 1)
      else if (index < nextState.activeIndex) nextState.activeIndex -= 1
      saveStackedPageState(nextState)
      if (wasActive) navigateToStackedPage(nextState.tabs[nextState.activeIndex])
      else renderStackedPages()
    })
    item.appendChild(close)
    strip.appendChild(item)
  })

  container.appendChild(strip)
}

let stackedPagesTimer: number | undefined
function normalizeStackedPagesAfterNavigation() {
  window.clearTimeout(stackedPagesTimer)
  stackedPagesTimer = window.setTimeout(renderStackedPages, 0)
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
  migrateTechniqueProgress(
    readProgress(),
    entries.map((entry) => entry.slug),
  )

  let activeBelt: keyof typeof groups = "blue"
  const shell = document.createElement("div")
  shell.className = "exam-tracker-shell"
  root.replaceChildren(shell)

  const render = () => {
    const progress = migrateTechniqueProgress(
      readProgress(),
      entries.map((entry) => entry.slug),
    )
    const group = groups[activeBelt]
    const complete = group.filter((entry) => progress[entry.slug] === "done").length
    const working = group.filter((entry) => progress[entry.slug] === "working").length
    const beltLabel =
      activeBelt === "brown"
        ? "Brown-only preview"
        : `${activeBelt[0].toUpperCase()}${activeBelt.slice(1)} belt`

    shell.innerHTML = `
      <div class="tracker-head">
        <div><p class="eyebrow">Exam requirements</p><h2>${beltLabel}</h2></div>
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
        <p class="eyebrow">My progress</p>
        <strong>Practice status</strong>
        <small>Saved only in this browser</small>
      </div>
      <button class="technique-progress-toggle" type="button"></button>`
    article.prepend(control)

    control
      .querySelector<HTMLButtonElement>(".technique-progress-toggle")!
      .addEventListener("click", () => {
        const progress = migrateTechniqueProgress(readProgress(), [slug])
        const next = cycleState(progress[slug])
        if (next) progress[slug] = next
        else delete progress[slug]
        saveProgress(progress)
        buildRequirementProgress()
      })
  }

  const state = migrateTechniqueProgress(readProgress(), [slug])[slug]
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
    heading.innerHTML = `<p class="eyebrow">Expanded technique map</p><strong></strong><small></small>`
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
let explorerObservers: MutationObserver[] = []

function disconnectPageObservers() {
  canvasObservers.forEach((observer) => observer.disconnect())
  canvasObservers = []
  explorerObservers.forEach((observer) => observer.disconnect())
  explorerObservers = []
}

async function normalizeCanvasLabels() {
  const links = document.querySelectorAll<HTMLAnchorElement>(".canvas-file-label a[data-slug]")
  if (links.length === 0) return

  const data = (await fetchData) as Record<string, { title?: string }>
  links.forEach((link) => {
    const title = data[link.dataset.slug ?? ""]?.title
    if (title) link.textContent = title
  })
}

function prioritizeExamCatalogue() {
  document.querySelectorAll<HTMLUListElement>(".explorer-ul").forEach((list) => {
    const moveCatalogueFirst = () => {
      list
        .querySelector<HTMLElement>(
          '.folder-container[data-folderpath="families/index"] .folder-title',
        )
        ?.replaceChildren("Families")

      const catalogue = Array.from(list.children).find((item) =>
        item.querySelector<HTMLAnchorElement>(":scope > a")?.href.includes("exam-catalogue.base"),
      )
      if (!catalogue) return false
      catalogue.classList.add("exam-catalogue-nav")
      if (list.firstElementChild !== catalogue) list.prepend(catalogue)
      return true
    }

    if (moveCatalogueFirst()) return
    const observer = new MutationObserver(() => {
      if (moveCatalogueFirst()) observer.disconnect()
    })
    observer.observe(list, { childList: true })
    explorerObservers.push(observer)
  })
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
    normalizeCanvasLabels()
    prioritizeExamCatalogue()
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
document.addEventListener("prenav", disconnectPageObservers)
window.addEventListener("grapplegraph-progress", buildRequirementProgress)
window.addEventListener("resize", normalizeStackedPagesAfterNavigation)
buildExamTracker()
normalizeStackedPagesAfterNavigation()
schedulePageEnhancements()
