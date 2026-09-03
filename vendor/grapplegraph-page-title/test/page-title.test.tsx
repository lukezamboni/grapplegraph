import { render } from "preact-render-to-string"
import { describe, expect, it } from "vitest"
import PageTitle from "../src/index"

function renderTitle(baseUrl: string | undefined, serve: boolean) {
  const component = PageTitle()
  return render(
    component({
      cfg: { pageTitle: "GrappleGraph", baseUrl },
      ctx: { argv: { serve } },
    } as never) as never,
  )
}

describe("GrappleGraph page title", () => {
  it("links directly to the GitHub Pages project root", () => {
    expect(renderTitle("lukezamboni.github.io/grapplegraph", false)).toContain(
      'href="/grapplegraph/"',
    )
  })

  it("links to the server root during local development", () => {
    expect(renderTitle("lukezamboni.github.io/grapplegraph", true)).toContain('href="/"')
  })
})
