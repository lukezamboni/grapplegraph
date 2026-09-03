import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.tsx",
    "components/index": "src/components/index.ts",
  },
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.build.json",
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  splitting: false,
  noExternal: [/.*/],
  external: ["preact", "preact/jsx-runtime", "@jackyzha0/quartz", "@jackyzha0/quartz/*"],
  outDir: "dist",
  platform: "node",
  esbuildOptions(options) {
    options.jsx = "automatic"
    options.jsxImportSource = "preact"
  },
})
