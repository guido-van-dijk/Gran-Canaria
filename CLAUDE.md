# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other AI assistants working in this repository.

## Current state of this repository

**This repository is empty.** At the time this file was written it contained no
commits, no branches, and no source files — the GitHub API reports
`409 Git Repository is empty` for `guido-van-dijk/Gran-Canaria`, and this file is
the first content added to it.

That means there is deliberately **no** description of application structure,
build commands, test commands, architecture, or coding conventions below: none
exist yet, and documenting invented ones would be actively misleading.

### What to do about that

When you are the first assistant to add real code here:

1. Read the code that now exists before trusting anything in this file.
2. Replace the placeholder sections below with what you actually observe —
   real commands you have run successfully, real directory layout, real
   conventions visible in the code.
3. Delete this "Current state" section once the repository has content.

Do not extend the placeholders with guesses. An empty section is more useful
than a wrong one.

## Repository

- **Remote:** https://github.com/guido-van-dijk/Gran-Canaria (public)
- **Owner:** guido-van-dijk
- **Default branch:** not yet created (the repo has no refs)

## Development workflow

### Branching

Work happens on feature branches, not directly on the default branch. Claude
Code sessions are assigned a branch of the form `claude/<topic>-<suffix>` and
must push only to that branch.

```bash
git checkout -b <branch-name>          # create the branch if it does not exist
git push -u origin <branch-name>       # always use -u origin <branch>
```

Never push to a branch other than the one assigned for the session without
explicit permission.

### Commits

- One logical change per commit.
- Imperative, descriptive subject lines (`Add …`, `Fix …`, `Update …`).
- Commit and push only when the user asks for it.

### Pull requests

Do not open a pull request unless the user explicitly requests one. If a PR
template is added under `.github/`, populate its headings rather than writing a
freeform body.

## Project structure

_Not yet applicable — the repository contains no source files._

Once code lands, document here: the top-level directories, what lives in each,
and where the entry point(s) are.

## Build, test, and run

_Not yet applicable — there is no build system, package manifest, or test suite._

Once tooling lands, document here the exact commands (install, build, test,
lint, typecheck, dev server) and verify each one runs before recording it.

## Conventions

_Not yet applicable — no code exists to derive conventions from._

Once code lands, document here: language and version, formatter/linter
configuration, naming and file-layout patterns, error-handling style, and any
rule that is not obvious from reading a single file.

## Notes for AI assistants

- Match the surrounding code's style once there is surrounding code; until then,
  follow the conventions of whatever stack the user introduces.
- Prefer verifying over assuming: run the commands, read the files, and correct
  this document when it drifts from reality.
- Keep this file current. If you change how the project is built, tested, or
  laid out, update the matching section in the same change.
