---
paths:
  - "docs/reference/DEPLOYMENT.md"
  - "README.md"
---

# Deployment documentation

`docs/reference/DEPLOYMENT.md` is committed in this repo on purpose, and
`README.md` links to it. Keep the link.

The repo is public, and a guide that lets someone self-host is worth shipping.
It contains the procedure (`openssl rand -base64 48`, `wrangler secret put`,
DNS record shapes) and no secret values. Never paste an actual secret, key,
token or account credential into it. Values go in `wrangler secret`, names go
in the doc.
