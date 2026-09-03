# GrappleGraph

GrappleGraph is a web-based study atlas for the Renzo Gracie Niagara Brazilian Jiu-Jitsu curriculum. It turns exam requirements into a connected map of positions, movements, transitions, and submissions while keeping the original sequence cards easy to browse.

**Live site:** <https://lukezamboni.github.io/grapplegraph/>

> GrappleGraph is an unofficial study aid. Videos and written cues are references only; confirm grips, details, and sequence order with your professor.

## What the site includes

- Blue (`BLU-01`–`BLU-30`), purple (`PUR-01`–`PUR-27`), and brown-only (`BRO-01`–`BRO-03`) exam requirements
- A filterable local graph and an expanded full-screen graph that preserve the current page context
- Browser-local progress states: not started, working, and done
- Stacked-page navigation for opening sequence components without losing the originating technique
- An Obsidian Bases exam catalogue with belt, family, finish, video, and verification views
- Curated Canvas system maps for closed guard, De La Riva, and standing pathways
- Embedded YouTube references on every technique, position, movement, and submission page
- Light and dark versions of the Motion Atlas visual system

Progress is intentionally stored in the current browser with `localStorage`; it is not synced to an account or sent to a server.

## Technology

The site is built with [Quartz 5](https://quartz.jzhao.xyz/) and published as a static site on GitHub Pages. Repository-local Quartz components provide GrappleGraph's filtered graph and base-path-safe navigation.

Requirements:

- Node.js 22 or newer
- npm 10.9.2 or newer

## Local development

```sh
npm ci
npm run dev
```

The development server prints its local URL. The production build goes to `public/`:

```sh
npm run build
```

Useful commands:

| Command                   | Purpose                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| `npm run validate`        | Type-check, format-check, run core and graph tests, and audit curriculum content |
| `npm run audit:content`   | Validate counts, numbering, metadata, videos, concept links, and Wikilinks       |
| `npm run audit:site`      | Check generated descriptions, links, assets, and graph runtime dependencies      |
| `npm run test:core`       | Run Quartz core tests without accidentally collecting vendored Vitest tests      |
| `npm run test:graph`      | Run the local graph-plugin test suite                                            |
| `npm run test:page-title` | Verify project-root navigation locally and on GitHub Pages                       |
| `npm audit --omit=dev`    | Check production dependencies against npm advisories                             |
| `npm run format`          | Apply Prettier formatting                                                        |

`npm run build` installs configured Quartz plugins and rebuilds the local component packages before generating the site.

## Content model

Curriculum notes live in `content/`:

```text
content/
├── techniques/
│   ├── blue-belt/
│   ├── purple-belt/
│   └── brown-belt-only/
├── positions/
├── movements/
├── submissions/
├── families/
├── maps/
└── Exam catalogue.base
```

Each technique records `exam_id`, `source_exam_id`, `belt`, `family`, `start`, `landing`, `finish`, `video_match`, and `instructor_verified`. The human-readable title uses the site identifier (`BLU`, `PUR`, or `BRO`); `source_exam_id` preserves the number printed on the academy sheet where those differ.

The sequence body must link its declared start, landing, and finish concepts. Those explicit links are what make filtered graph views complete and predictable. New reference notes also need a direct YouTube watch URL so Quartz can render the video embed.

See [DATA_REVIEW.md](./DATA_REVIEW.md) for source-of-truth decisions and details still awaiting academy confirmation.

## Project structure

| Path                                               | Responsibility                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `content/`                                         | Published curriculum and study notes                                            |
| `quartz.config.yaml`                               | Enabled Quartz plugins, layout, theme, and deployment base URL                  |
| `quartz/components/scripts/grapplegraph.inline.ts` | Progress tracker, stacked navigation, catalogue ordering, and page enhancements |
| `quartz/styles/custom.scss`                        | Motion Atlas visual identity and responsive behavior                            |
| `vendor/grapplegraph-graph/`                       | Local graph component, filters, and full-screen rendering                       |
| `vendor/grapplegraph-page-title/`                  | Site-title component with GitHub Pages base-path handling                       |
| `scripts/content-audit.mjs`                        | Curriculum integrity checks                                                     |
| `.github/workflows/`                               | Pull-request validation and GitHub Pages deployment                             |

Do not edit `public/` or `.quartz/`; both are generated.

## Deployment and branches

`v5` is the production branch. A push to `v5` runs the validation workflow and the GitHub Pages workflow, which publishes `public/` using GitHub’s Pages artifact deployment.

For a normal change:

1. Edit source content or code.
2. Run `npm run validate`.
3. Run `npm run build` for changes that affect rendering or assets.
4. Commit and push to `v5` (or open a pull request targeting `v5`).

The `upstream` remote tracks Quartz itself; GrappleGraph-specific code belongs on `origin`.

## Contributing curriculum corrections

Corrections are welcome, especially academy-specific sequence details. Please identify the belt and requirement ID, describe what should change, and distinguish an academy-taught detail from a general BJJ reference. Leave `instructor_verified: false` until a professor has confirmed the complete sequence.

The project code is available under the repository’s MIT license. Linked videos remain the property of their creators.
