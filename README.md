# GrappleGraph

GrappleGraph is a Renzo Gracie Niagara-themed study atlas for connecting Brazilian Jiu-Jitsu exam sequences, positions, movements, and submissions.

The Quartz 5 site includes:

- Blue-, purple-, and brown-only exam requirement views
- A filterable relationship graph
- A browser-local progress tracker with not-started, working, and done states
- Stacked-page navigation for exploring sequence components without losing the source technique
- Video study resources and academy-verification reminders

Live site: <https://lukezamboni.github.io/grapplegraph/>

## Local development

```sh
npm install
npx quartz build --serve
```

The site is published to GitHub Pages by the workflow in `.github/workflows/deploy.yml` when the `v5` branch is updated.

> GrappleGraph is an unofficial study aid. Confirm grips, details, and sequence order with a Renzo Gracie Niagara instructor.
