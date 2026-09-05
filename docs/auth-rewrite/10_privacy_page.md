# Phase 10 — Privacy page

- **Goal:** Architecture-as-plain-English at `/privacy`. KISS.
- **Files:** new `src/routes/privacy.tsx`; route registration in `src/App.tsx`; possibly `src/components/architecture-diagram.tsx` or an inline SVG; link from landing page footer.
- **Gates:** Q8 (repo visibility — whether to link).
- **Size:** S–M
- **Deps:** [Phase 1](01_crypto_storage_design.md) final design doc (so copy reflects reality, not aspiration). Otherwise standalone.

**Status (2026-09-05): partially shipped, ahead of this phase.** `/privacy` exists at
`src/routes/privacy.tsx`, registered outside `RootLayout` and linked from the landing
page footer, the Privacy & Trust card, and Settings > About. It went in early because
landing page analytics were added and the "No tracking. No analytics." copy had to stop
being false.

Shipped: where data lives, cloud sync encryption, analytics, hosting, no ads/no selling.

Still to do, and still gated: the per-network-call breakdown of what the server sees,
what would be handed over if compelled, the recovery tradeoff, and the repo link. These
depend on the Phase 1 crypto design being final (so the copy describes reality) and on
Q8 for the repo link. The architecture diagram is also still outstanding.

**Not optional:** the page must say plainly that data on
your device is **not encrypted at rest** — it sits in IndexedDB in the clear,
and the account password protects the cloud copy, not the local one. At-rest
encryption is parked (`../HANDOVER.md`), so this is the durable state of things
rather than a gap awaiting a fix. "Your data stays on your device" remains true
and is a different claim; the risk is that a reader hears the second and assumes
the first.

The same page must also avoid implying that a household partner *cannot* see
your personal spending. They hold the same household key; the split is enforced
in the UI. See `08_household_ui_scope.md`.

Sections to include (per handoff): where your data lives, what we see/don't see at each network call, what we'd hand over if compelled, the recovery tradeoff stated honestly, repo link if public, attribution to `../rocketzip`. Reference frames: Standard Notes / Proton threat-model writeups; `../saintheaven` for tone.
