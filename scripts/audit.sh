#!/bin/sh
# Fails on any high-severity finding in the root or in worker/, which has its
# own lockfile, and says what to do about it.

audit_failed=0
npm audit --audit-level=high || audit_failed=1
(cd worker && npm audit --audit-level=high) || audit_failed=1

if [ "$audit_failed" -ne 0 ]; then
  echo
  echo "npm audit found a high-severity vulnerability. To fix it:"
  echo "  - Bump the package that pulls it in. If the fixed release is under"
  echo "    7 days old, override .npmrc once:"
  echo "    npm install <pkg> --min-release-age=0"
  echo "  - If no fixed release exists yet, git push --no-verify gets an"
  echo "    unrelated change out."
fi

exit "$audit_failed"
