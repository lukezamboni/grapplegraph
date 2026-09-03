// ../../node_modules/preact/dist/preact.mjs
var l
;((l = {
  __e: function (n2, l2, u3, t2) {
    for (var i2, r2, o2; (l2 = l2.__);)
      if ((i2 = l2.__c) && !i2.__)
        try {
          if (
            ((r2 = i2.constructor) &&
              null != r2.getDerivedStateFromError &&
              (i2.setState(r2.getDerivedStateFromError(n2)), (o2 = i2.__d)),
            null != i2.componentDidCatch && (i2.componentDidCatch(n2, t2 || {}), (o2 = i2.__d)),
            o2)
          )
            return (i2.__E = i2)
        } catch (l3) {
          n2 = l3
        }
    throw n2
  },
}),
  "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout,
  Math.random().toString(8))

// ../../node_modules/preact/jsx-runtime/dist/jsxRuntime.mjs
var f2 = 0
function u2(e2, t2, n2, o2, i2, u3) {
  t2 || (t2 = {})
  var a2,
    c2,
    p2 = t2
  if ("ref" in p2) for (c2 in ((p2 = {}), t2)) "ref" == c2 ? (a2 = t2[c2]) : (p2[c2] = t2[c2])
  var l2 = {
    type: e2,
    props: p2,
    key: n2,
    ref: a2,
    __k: null,
    __: null,
    __b: 0,
    __e: null,
    __c: null,
    constructor: void 0,
    __v: --f2,
    __i: -1,
    __u: 0,
    __source: i2,
    __self: u3,
  }
  if ("function" == typeof e2 && (a2 = e2.defaultProps))
    for (c2 in a2) void 0 === p2[c2] && (p2[c2] = a2[c2])
  return (l.vnode && l.vnode(l2), l2)
}

// src/index.tsx
function productionHome(baseUrl) {
  if (!baseUrl) return "/"
  const pathname = new URL(`https://${baseUrl}`).pathname.replace(/\/+$/, "")
  return `${pathname}/`
}
var src_default = () => {
  const PageTitle = ({ cfg, ctx, displayClass }) => {
    const title = cfg.pageTitle ?? "GrappleGraph"
    const isServe = ctx.argv?.serve ?? false
    const home = isServe ? "/" : productionHome(cfg.baseUrl)
    const classes = [displayClass, "page-title"].filter(Boolean).join(" ")
    return /* @__PURE__ */ u2("h2", {
      class: classes,
      children: /* @__PURE__ */ u2("a", { href: home, children: title }),
    })
  }
  PageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
}
`
  return PageTitle
}

export { src_default as PageTitle }
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
