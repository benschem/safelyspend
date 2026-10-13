# How the docs work

Read this before adding to, or working from, anything in `docs/`. It applies to
people and to coding agents alike.

There are three kinds of document, and each has one job.

```
docs/
  README.md      this file
  BACKLOG.md     the queue
  work/          one file per piece of work
  reference/     how the project is now
```

## 1. The queue: `BACKLOG.md`

The only list of work. If something is not in it, it is not tracked. There is
no separate roadmap, to-do list or wishlist.

- **One line per item.** Detail goes in a work file, never in the queue.
- **Position is priority.** The top line of Now is the next thing to do. There
  are no priority labels.
- **Sections, in order:** Now (at most three items), Next, Later, Wishlist,
  Inbox.
- **Line format:** `- [type]    What is wrong or wanted → work/slug.md _(area, area)_`.
  The link is left off when one line says it all.
- **Pad after the type** so every description starts in the same column:
  `[feature]` and `[cleanup]` take one space, `[polish]` two, `[bug]` five.
- **Keep the description short**, about sixty characters. It names the item;
  the work file explains it.
- **Types:** `bug`, `feature`, `cleanup`, `polish`. Nothing else.
- **Areas** are a fixed list at the top of `BACKLOG.md`. An item can have more
  than one. Add a new area on purpose, not per item.

## 2. Work files: `work/<slug>.md`

The detail for one piece of work: why it matters, what has been decided, and
the steps. Several queue lines can point at one work file when one plan covers
them.

Each starts with:

- **Status:** not started, in progress (with the step reached), or parked (with
  the reason).
- **Goal:** what is true when it is done.
- **Touches:** the main files or modules it will change.

Then Why, Decided, Proposed (anything still needing a yes), Steps, and Not in
this plan. Mark what has been checked against the code and what has only been
read about or assumed.

## 3. Reference docs: `reference/`

`ARCHITECTURE.md`, `DECISIONS.md`, `crypto-design.md` and the rest describe how
the project is now. They are not plans and hold no lists of work. Change them
in the same commit as the code that makes them untrue.

## Rules

- **Picking up the next thing** means the top line of Now. Read its work file.
  If it has no steps yet, write them and stop for review before changing code.
- **Check for related work before planning.** Read the other queue lines that
  share an area, and search `work/` for the paths in the item's Touches line.
  Name any overlap in the plan.
- **Noticed something while doing something else?** Add one line to Inbox and
  carry on. Do not fix it in the current change, and do not write it up
  anywhere else.
- **Only the maintainer moves items out of Inbox or reorders the queue.** An
  agent may propose an order; it does not apply one.
- **Done means deleted.** Remove the queue line and the work file in the same
  change as the code. Git history and the changelog are the record. A decision
  that outlives the work moves into a reference doc first.
- **Docs go with the work.** Queue, work file and reference doc changes are
  staged with the change they belong to, not left to pile up.
