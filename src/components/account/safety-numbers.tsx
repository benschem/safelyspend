/**
 * The two safety numbers a pair of people compare, each labelled with whose
 * key it belongs to.
 *
 * Both sides of a handoff render this: the invitee waiting to join, and (Phase
 * 7 step 6) the existing member approving them. Each passes its own number as
 * `yours`, so the same layout reads correctly from either seat.
 *
 * Pass `theirs` as null while the other person's key is not known yet, as for
 * an invitee whose key has not been handed over: only their own number shows.
 *
 * Every number given here must come from `safetyNumberFor` on the key itself,
 * never from a fingerprint the server supplied.
 */
export function SafetyNumbers({
  yours,
  theirs,
}: {
  yours: string;
  theirs: { label: string; safetyNumber: string } | null;
}) {
  return (
    <div className="space-y-3">
      {theirs && <SafetyNumberCard label={theirs.label} safetyNumber={theirs.safetyNumber} />}
      <SafetyNumberCard label="Yours" safetyNumber={yours} />
    </div>
  );
}

function SafetyNumberCard({ label, safetyNumber }: { label: string; safetyNumber: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      {/* Monospace and widely tracked, so the groups read cleanly aloud. */}
      <p className="mt-1 font-mono text-2xl font-semibold tracking-widest">{safetyNumber}</p>
    </div>
  );
}
