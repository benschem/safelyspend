import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { SafetyNumbers } from '@/components/account/safety-numbers';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildHandoffWrap, markPublicKeyConfirmed } from '@/lib/account';
import { api, type PendingHandoff } from '@/lib/api-client';
import { base64urlToBytes } from '@/lib/base64url';
import { debug } from '@/lib/debug';
import { derivePublicKey, safetyNumberFor } from '@/lib/key-management';
import { getMasterKey, getPrivateKey } from '@/lib/key-vault';

/**
 * An invitee waiting on this member, with both safety numbers ready to show.
 *
 * Make one only with `loadInviteeApproval`, which computes both numbers from
 * the keys themselves.
 */
export interface InviteeApproval {
  handoff: PendingHandoff;
  inviteeSafetyNumber: string;
  ownSafetyNumber: string;
}

/**
 * Everything the approval dialog shows for one invite. Null when it could not
 * be read, nobody is waiting on the invite any more, or the vault is locked.
 *
 * The invitee's number is computed from their key rather than read from the
 * fingerprint served beside it: a real key with a mismatched fingerprint is
 * the attack the comparison exists to catch.
 *
 * Never throws, so a caller branches on the result alone.
 */
export async function loadInviteeApproval(inviteId: string): Promise<InviteeApproval | null> {
  const privateKey = getPrivateKey();
  if (!privateKey) return null;

  try {
    const { handoffs } = await api.handoffs.pending();
    const handoff = handoffs.find((pendingHandoff) => pendingHandoff.inviteId === inviteId);
    if (!handoff) return null;

    const [inviteeSafetyNumber, ownSafetyNumber] = await Promise.all([
      safetyNumberFor(base64urlToBytes(handoff.inviteePubkey)),
      safetyNumberFor(derivePublicKey(privateKey)),
    ]);
    return { handoff, inviteeSafetyNumber, ownSafetyNumber };
  } catch (err) {
    debug.error('ui', 'Could not load the invitee to approve', err);
    return null;
  }
}

// Covers a dropped connection, a server error and a cancelled invite alike,
// so it claims none of them. Trying again is safe: the worker answers a
// repeated approval as the no-op it is.
const APPROVAL_FAILURE_WORDING = 'We could not approve them. Please try again.';

/**
 * Where an existing member checks an invitee's safety number and hands them
 * the household key.
 *
 * A first cut: one screen, and Cancel is the whole of "they do not match".
 * `docs/work/household-join.md` lists what was left out.
 *
 * It stays open after approving, with both numbers still showing. The
 * invitee's screen asks for this member's number next, and this dialog is the
 * only place the app shows it.
 *
 * A vault that locks while this is open leaves it open: the numbers are
 * already on screen, and pressing "The numbers match" says to unlock.
 *
 * Mount it only while there is someone to approve, so each opening starts
 * from a fresh comparison.
 */
export function ApproveInviteeDialog({
  approval,
  onClose,
  onApprovalSettled,
}: {
  approval: InviteeApproval;
  onClose: () => void;
  /** Called after every attempt, failed or not, so the caller can re-read its invites. */
  onApprovalSettled: () => void;
}) {
  const [status, setStatus] = useState<'comparing' | 'approving' | 'approved'>('comparing');
  const [error, setError] = useState<string | null>(null);
  const { handoff } = approval;

  const handleNumbersMatch = async () => {
    const masterKey = getMasterKey();
    const privateKey = getPrivateKey();
    if (!masterKey || !privateKey) {
      setError('Your vault is locked. Unlock it, then approve them again.');
      return;
    }

    setError(null);
    setStatus('approving');
    try {
      const handoffWrap = await buildHandoffWrap(
        { masterKey, privateKey },
        // The key the displayed number was computed from, and only that key.
        markPublicKeyConfirmed(handoff.inviteePubkey),
      );
      await api.households.addMember(handoff.householdId, {
        inviteId: handoff.inviteId,
        inviteeUserId: handoff.inviteeUserId,
        ...handoffWrap,
      });
      setStatus('approved');
    } catch (err) {
      debug.error('ui', 'Could not approve the invitee', err);
      setError(APPROVAL_FAILURE_WORDING);
      setStatus('comparing');
    } finally {
      onApprovalSettled();
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    // Closing mid-request would hide whether the approval landed.
    if (!nextOpen && status !== 'approving') onClose();
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {status === 'approved' ? 'Now read out your number' : 'Check the safety numbers'}
          </DialogTitle>
          <DialogDescription>
            {status === 'approved'
              ? `${handoff.recipientEmail} can now join. In a few seconds their screen will ask for your safety number. Read yours out to them so they can check it.`
              : `Ask ${handoff.recipientEmail} to read out the safety number on their screen, and check it matches theirs below. Do this in person or on a call, not by email or message. If the numbers are different, cancel and do not approve them.`}
          </DialogDescription>
        </DialogHeader>

        <SafetyNumbers
          yours={approval.ownSafetyNumber}
          theirs={{
            label: `${handoff.recipientEmail}'s`,
            safetyNumber: approval.inviteeSafetyNumber,
          }}
        />

        {error && <Alert variant="destructive">{error}</Alert>}

        <DialogFooter>
          {status === 'approved' ? (
            <Button onClick={onClose} className="cursor-pointer">
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={status === 'approving'}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleNumbersMatch()}
                disabled={status === 'approving'}
                className="cursor-pointer"
              >
                {status === 'approving' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'The numbers match'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
