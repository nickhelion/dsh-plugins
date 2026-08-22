# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in `nickhelion/dsh-plugins`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, including labels and comments when needed.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments` with appropriate filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`.
- **Apply/remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v`; commands run from this clone target `nickhelion/dsh-plugins`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares one number space across issues and PRs. Resolve an ambiguous bare number with `gh pr view <number>` and fall back to `gh issue view <number>`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: an issue labelled `wayfinder:map`, holding Destination, Notes, Decisions-so-far, Not-yet-specified, and Out-of-scope.
- **Child ticket**: a GitHub sub-issue of the map, labelled `wayfinder:<type>` (`research`, `prototype`, `grilling`, or `task`). If sub-issues are unavailable, add the child to a task list in the map and put `Part of #<map>` at the top of the child body.
- **Blocking**: use GitHub native issue dependencies. The dependency endpoint requires the blocker's numeric database `id`, not its issue number or `node_id`. If dependencies are unavailable, keep a `Blocked by: #<n>, #<n>` line in the child body.
- **Frontier**: open map children with no open blocker and no assignee, in map order.
- **Claim**: `gh issue edit <n> --add-assignee @me` before any ticket work.
- **Resolve**: comment with the answer, close the issue, then append a one-line gist and issue link to the map's Decisions-so-far.

Canonical labels:

- `wayfinder:map`
- `wayfinder:research`
- `wayfinder:prototype`
- `wayfinder:grilling`
- `wayfinder:task`
