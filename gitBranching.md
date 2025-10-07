# Contributing Guide

## Branch Model
- `main`: production-grade; tagged releases only.
- `dev`: integration trunk; all task PRs target `dev`.
- `feature/<owner>/<scope>`: short-lived branches from `dev`.

## Naming
- feature/bartu/auth-jwt-token
- fix/kerem/duplicate-course-code
- chore/ci/add-pytest
- docs/api/openapi-tuning

## Working Agreement
1. `git checkout dev && git pull && git checkout -b feature/<owner>/<scope>`
2. Small atomic commits (Conventional Commit style).
3. Draft PR early; link issue (`Fixes #123`).
4. CI must be green.
5. Rebase on `origin/dev` before merge.
6. Squash-merge to keep history clean.

## Commit Convention (Conventional Commits)
Examples:
- feat(auth): issue JWT at /api/v1/auth/token
- fix(courses): reject duplicate course code
- chore(ci): add pytest workflow

## PR Quality Gate
- 1 approval (dev), 2 approvals (main)
- Tests pass (`ci` job)
- Title follows Conventional Commits

## Release Process
- Stabilize on `dev` → optional `release/x.y.z` → merge to `main` → tag `vX.Y.Z`.
