# GrappleGraph

An interactive map of Brazilian Jiu-Jitsu techniques, positions, and transitions.

GrappleGraph turns a 30-technique white-to-blue-belt exam into a connected study atlas. Every exam technique is a Markdown note linked to its starting position, primary movements, landing position, submission, related techniques, and provisional video references.

## What is included

- All 30 exam sequences with permanent exam IDs
- Six colour-coded study families
- Connected notes for positions, movements, transitions, and submissions
- Local and global graph views
- Search, backlinks, dark mode, and mobile layouts
- Practice checklists and instructor-verification fields
- GitHub Pages deployment through GitHub Actions

## Work locally

Requirements: Node.js 22 or later and npm 10.9.2 or later.

```bash
npm ci
npx quartz build --serve
```

The local site is served at `http://localhost:8080`.

## Edit the atlas

Site content lives in `content/` and can be edited as ordinary Markdown or opened as an Obsidian vault. Technique cards are stored in `content/techniques/`; shared concepts are under `positions/`, `movements/`, and `submissions/`.

All video matches and technical details should remain marked as provisional until verified against the academy-specific version.

## Publishing

Pushes to the `v4` branch build and deploy the site to GitHub Pages automatically.

Built with [Quartz](https://quartz.jzhao.xyz/).
