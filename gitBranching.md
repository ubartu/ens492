# Contributing Guide

## Branch Model
- `main`: production-grade; tagged releases only.
- `dev`: integration trunk; all task PRs target `dev`.
- `feature/<owner>/<scope>`: short-lived branches from `dev`.

## Naming
-Feature: feature/<yourname>/<short-scope> (e.g., feature/kerem/courses-crud)

-Fix: fix/<yourname>/<short-scope>

-Chore/Infra: chore/<yourname>/<short-scope>

-Release: release/x.y.z

-Hotfix: hotfix/x.y.z+1

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


