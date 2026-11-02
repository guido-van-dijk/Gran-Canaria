# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other AI assistants working in this repository.

## Repository

- **Remote:** https://github.com/guido-van-dijk/Gran-Canaria (public)
- **Owner:** guido-van-dijk

## Project structure

- `school-tour/`: a 3D onboarding tour of a school entrance for new students, built with three.js.
  - `index.html` is the entry point. It loads three.js from `node_modules` through an import map, so there is no bundler.
  - `main.js` builds the scene: the coloured-panel wing, the cream tower with porthole domes, the entrance, golden-hour lighting, and a camera matched to the reference photo.
  - `tour.js` adds the onboarding layer: numbered stops, camera flights and Dutch info cards. It is loaded only when the page is opened without `?capture`.
- `.claude/skills/dream-loop/`: the vendored Dream Loop skill (MIT, achimala/dream-loop), used to iterate the visuals against a target image.
- `.dream-loop/` (gitignored): the skill's working files, including `target.png`, captures and the capture/compare scripts.

## Build, test, and run

```bash
cd school-tour && npm install         # installs three.js
npm start                             # serves the repo root at http://127.0.0.1:4172
# open http://127.0.0.1:4172/school-tour/            -> interactive tour
# open http://127.0.0.1:4172/school-tour/?capture    -> fixed photo-matched view, renders 3 frames, exposes window.__png
node --test .claude/skills/dream-loop/scripts/fal-batch.test.mjs   # skill helper tests
```

The project has no build step and no linter. Headless capture uses the preinstalled Playwright Chromium with SwiftShader. `?capture` mode stops the render loop after 3 frames because software WebGL is slow.

## Conventions

- Plain ES modules, 2-space indent, single quotes, no build tooling.
- Scene units are metres. The camera sits at (0, 1.6, 0) looking down -z, with a lens-shifted projection (`view` in `main.js`) that reproduces the reference photo.
- Textures are generated procedurally on canvases. There are no binary assets in the repo.
- UI text for students is in Dutch.

## Development workflow

- Work happens on feature branches. Claude Code sessions use `claude/<topic>-<suffix>` and push only to that branch: `git push -u origin <branch>`.
- One logical change per commit, with imperative subject lines. Commit and push only when the user asks.
- Do not open a pull request unless the user explicitly requests one.

## Notes for AI assistants

- Verify instead of assuming: run the commands above and keep this file current when the layout or commands change.
