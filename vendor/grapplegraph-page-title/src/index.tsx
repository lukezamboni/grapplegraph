import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types"

function productionHome(baseUrl?: string): string {
  if (!baseUrl) return "/"
  const pathname = new URL(`https://${baseUrl}`).pathname.replace(/\/+$/, "")
  return `${pathname}/`
}

export default (() => {
  const PageTitle: QuartzComponent = ({ cfg, ctx, displayClass }: QuartzComponentProps) => {
    const title = cfg.pageTitle ?? "GrappleGraph"
    const isServe = (ctx as { argv?: { serve?: boolean } }).argv?.serve ?? false
    const home = isServe ? "/" : productionHome(cfg.baseUrl)
    const classes = [displayClass, "page-title"].filter(Boolean).join(" ")

    return (
      <h2 class={classes}>
        <a href={home}>{title}</a>
      </h2>
    )
  }

  PageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
}
`

  return PageTitle
}) satisfies QuartzComponentConstructor
