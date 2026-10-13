# Give the account its own page and a clear way in

- **Status:** not started. No direction chosen for the page or the entrance;
  the options for each are below.
- **Goal:** the account has its own page, signing out is reachable from every
  page, and the entrance says that it also creates accounts.
- **Touches:** `src/routes/settings.tsx`, `src/routes/login.tsx`,
  `src/components/layout/`, `src/App.tsx`.

## Why

Noticed on the first real run of signup, recovery and deletion against the
live API.

`src/routes/settings.tsx` is one page of about 1,600 lines with eight
sections: Initial Cash, Savings Balances, Cloud Sync, Data Management,
Appearance, Check-in, Developer, About. The account lives inside the third.
Cloud Sync alone carries connection state, push and pull, Active Sessions and
the Account block with deletion. Signing in, signing out and deleting the
account are all in there, below two sections of opening balances.

- **The page teaches the wrong model.** It presents "cloud sync" as a feature
  you connect, and the account as a detail of that feature. People think they
  have an account or they do not, and are signed in or are not. The page never
  says that the budget lives on this device whether or not they are signed in,
  or that deleting the account and deleting the data are different buttons
  with different consequences. "Delete All Data" (this device, under Data
  Management) and deleting the account (the server, under Cloud Sync) sit
  about sixty lines apart with no sentence connecting them.
- **Log out is hard to find.** People expect an account control in the top
  right of the header, or at the foot of the sidebar. Whichever option is
  chosen, sign in, sign out and a way to reach the account belong in one of
  those two places, visible from every page.

This is more than a cleanup. A first release can go out without it, but it is
the first thing the second person in a household will trip over, so do it
before then.

## Options for the page

- **Extract an Account page** (or "Account & sync"): signed-in state, email,
  sessions, log out, delete account. Settings keeps preferences. Probably the
  right cut, because it matches how people already think about apps.
- **Extract a "Your data" page**: where the budget lives, export, import,
  delete this device's data, and cloud backup as one option within it. Answers
  the local-versus-cloud confusion directly, but splits the account across two
  places.
- **Keep one page and restructure it**: tabs or a side index, with sessions
  collapsed. The cheapest, and it leaves log out where it is.

Whichever is chosen, the copy needs one plain sentence on what signing in
adds: your budget is always on this device; an account keeps an encrypted copy
in the cloud so you can use it on another device, share it with someone, and
get it back if this one is lost. The privacy page (`src/routes/privacy.tsx`)
has to say the same thing, so write it once.

## Nothing says sign up

Noticed at the start of the two-browser walkthrough of the invite UI,
2026-10-10.

A new person looks for "Sign up" or "Create account" and finds only sign in.
The flow does create accounts: `/login` takes an email and a code, and an
address with no account is carried on into choosing a password and a recovery
phrase. But nothing says so before the email is entered, so someone without an
account has no reason to think the sign-in door is theirs.

Options:

- **Say it on the one screen**: a heading and a line that cover both, such as
  "Sign in or create an account", and "New here? Enter your email and we will
  set you up." The cheapest, and keeps the single flow.
- **A separate "Create account" entrance** that leads into the same flow with
  its own heading. Matches what people expect to see, at the cost of two
  entrances that behave identically, and of deciding what each says when the
  address turns out to be the other kind.

Whichever is chosen, an entrance must not reveal whether an address already
has an account: the worker answers the same for both until the code is passed,
on purpose.
