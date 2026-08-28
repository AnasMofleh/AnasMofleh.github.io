# AnasMofleh.github.io

Anas Mofleh's personal website — a Hugo static site with the [Toha](https://github.com/hugo-toha/toha) theme, styled with a **black + gold** visual identity.

## What's in it

- **`/` — Analytics dashboard**: a full-viewport stats hero (projects, certifications, companies, positions, years of experience) with Chart.js visualizations, followed by the professional sections (About, Skills, Experiences, Projects, Education, Publications).
- **`/game/` — Gamified home**: a DOM-based platformer where Mario jumps between platforms, walks into warp pipes to enter the portfolio sections, and collects gold coins that reveal certifications. Hidden on mobile; touch users tap the pipes instead.

## How it's driven

- All content lives in `data/en/` (author, site, and one YAML file per section). The dashboard charts and the game's coins are computed from that data at build time.
- The platformer engine is `assets/js/platformer.js` (DOM + `requestAnimationFrame`), overlaid by `layouts/partials/home/platformer.html`, styled by the platformer block in `assets/styles/override.scss`.
- Two GitHub Actions workflows (`actions/projects_getter.py`, `actions/skills_reader.py`) refresh `projects.yaml` and `skills.yaml` from the GitHub API / local credential folders on a schedule — keep their field schema intact.

## Building

Hugo extended is required (Sass + Hugo modules):

```bash
hugo mod tidy
hugo mod npm pack   # regenerates packages/hugoautogen/
npm install         # supplies fonts/flags/katex via node_modules mounts
hugo server         # local dev
hugo --gc --minify  # production build
```

Deploys: Netlify (`netlify.toml`) and GitHub Pages (`.github/workflows/hugo.yaml`).
