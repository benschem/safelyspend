# The worker accepts any string as an invite address

- **Status:** not started.
- **Goal:** the worker rejects an invite whose recipient is not an email address.
- **Touches:** `worker/src/routes/invites.ts`.

## Why

`POST /v1/invites` (`worker/src/routes/invites.ts`) accepts any non-empty string
as `recipientEmail`. The only shape check is the client's
(`recipientAddressProblem` in `src/lib/invite-sending.ts`), so anything other
than this app's form can create an invite to a non-address, and the worker then
tries to email it.

Fix: reject it with a 400 using the pattern `worker/src/routes/auth.ts` already
has as `EMAIL_REGEX`. Keep the client check: the per-user limit runs before the
handler, so a typo that reaches the worker still spends one of the five issues
an hour.
