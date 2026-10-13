---
paths:
  - "docs/**/*.md"
  - "README.md"
  - "worker/README.md"
  - "CLAUDE.md"
  - ".claude/rules/*.md"
---

# Writing docs

Say as little as possible without losing anything a future reader needs. These
rules come from the 2026-10-13 rewrite, which had to undo all of the below.

## Structure

- One home per fact. Before writing something down, search for where it
  already lives and point there.
- Describe what exists. A reference doc says how the project is now; a work
  file says what is wrong or wanted. Neither narrates how the text got here:
  no "an earlier draft said", no "carried over from", no "raised from".
- When something changes, rewrite the passage. Do not append a correction
  below the old text, and do not strike text through.
- Keep history only where it carries a reason. Keep the reason, drop the story.
- Finished work leaves the doc. Git and the changelog are the record.
- Name a file when pointing at one. Not "the entry above", not a quoted title.
- Point at code by name, never by line number. Write `plannedEnd` in
  `cash-flow/index.tsx`, not `cash-flow/index.tsx:559`. A line number is
  wrong after the next edit to that file, and a name can be searched for.
- Use absolute dates. "Today" is wrong tomorrow.
- Keep "not checked" notes, in the Status line or a closing paragraph. Say
  what was read in the code and what was only assumed.

## Sentences

- No sentence that announces its own importance. State the fact.
  - Not: "This is the one that matters." "Worth stating plainly." "The honest
    answer is" "load-bearing" "full stop" "genuinely" "exactly what"
- No closing line that restates the paragraph in a quotable way.
  - Not: "The bank movement is plumbing; the rule is the truth."
- No em dashes. Use a full stop, comma or colon. `**Term**: definition` in a
  list.
- "X, not Y" only when Y is a real option that was rejected or a real
  distinction. Not as a flourish.
- Bold at the start of a bullet is a short label for a distinct item. No
  bolded sentences, and no bold for emphasis.
- Write ordinary sentences. Cutting every dash and connective until the prose
  is all short fragments reads just as mechanical.

## Format

- No tables. Use a list.
- Sentence-case headings.
- British/Australian spelling, except where a command, API or library fixes it.
- Wrap at about 78 characters.

## Before and after

> Skipping the verifier means OTP control alone now issues *some* session,
> which is precisely what the verifier exists to prevent. **This is the one
> that mattered** — taken literally it would have let a signup apply against
> an already-spent token.

> Skipping the verifier lets OTP control alone issue a session, which the
> verifier exists to prevent. Without the fix, a signup could apply against a
> spent token.
