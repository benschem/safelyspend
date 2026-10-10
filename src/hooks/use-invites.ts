import { useCallback, useEffect, useState } from 'react';
import { api, type SentInvite } from '@/lib/api-client';
import { debug } from '@/lib/debug';
import { classifyIssueFailure, type IssueFailure } from '@/lib/invite-sending';

/**
 * The invites this member has sent, as last read from the worker.
 *
 * `readAt` is the clock at that read. Whether an invite has expired is judged
 * against it (`sentInviteState`), so a render never consults the clock itself.
 */
export type SentInvitesLoad =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; sent: SentInvite[]; readAt: Date };

export type SendInviteOutcome = { ok: true } | { ok: false; failure: IssueFailure };

export type CancelInviteOutcome = { ok: true } | { ok: false };

interface UseInvitesReturn {
  sentInvitesLoad: SentInvitesLoad;
  /** Read the list again after it failed to load. */
  retryLoad: () => void;
  /** Email an invite. Expects an address already checked and normalised. */
  send: (recipientAddress: string) => Promise<SendInviteOutcome>;
  /** Revoke an invite, which also kills the link in its email. */
  cancel: (inviteId: string) => Promise<CancelInviteOutcome>;
  /** Read the list again after something outside this hook changed it. Never throws. */
  refresh: () => Promise<void>;
}

/**
 * The sending member's side of invites: the list, send and cancel.
 *
 * The list is read on mount and again after every action, whether the action
 * worked or not. A request can land on the worker and still fail on the way
 * back, and the list is what says which happened.
 *
 * Nothing here polls. An invitee signing up while this is on screen shows on
 * the next visit.
 */
export function useInvites(): UseInvitesReturn {
  const [sentInvitesLoad, setSentInvitesLoad] = useState<SentInvitesLoad>({ status: 'loading' });
  // Bumped by retryLoad, so the load effect runs afresh.
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    // Set by the cleanup, so a read that resolves after an unmount (or after
    // StrictMode's first run) shows nothing.
    let isAbandoned = false;

    api.invites
      .list()
      .then(({ sent }) => {
        if (!isAbandoned) setSentInvitesLoad({ status: 'ready', sent, readAt: new Date() });
      })
      .catch((err: unknown) => {
        if (isAbandoned) return;
        debug.error('ui', 'Could not load sent invites', err);
        setSentInvitesLoad({ status: 'failed' });
      });

    return () => {
      isAbandoned = true;
    };
  }, [loadAttempt]);

  const retryLoad = useCallback(() => {
    setSentInvitesLoad({ status: 'loading' });
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  /**
   * Re-read the list after an action. A failed read keeps the list already on
   * screen: it is stale, but replacing it with an error would hide the invites
   * the member was just acting on.
   *
   * Never throws, which is what lets `send` and `cancel` call it from a
   * `finally` without it replacing their outcome.
   */
  const refresh = useCallback(async () => {
    try {
      const { sent } = await api.invites.list();
      setSentInvitesLoad({ status: 'ready', sent, readAt: new Date() });
    } catch (err) {
      debug.error('ui', 'Could not refresh sent invites', err);
    }
  }, []);

  const send = useCallback(
    async (recipientAddress: string): Promise<SendInviteOutcome> => {
      try {
        // No expiry is passed, so the worker's default stays the only one.
        await api.invites.issue(recipientAddress);
        return { ok: true };
      } catch (err) {
        debug.error('ui', 'Could not send the invite', err);
        return { ok: false, failure: classifyIssueFailure(err) };
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  const cancel = useCallback(
    async (inviteId: string): Promise<CancelInviteOutcome> => {
      try {
        await api.invites.revoke(inviteId);
        return { ok: true };
      } catch (err) {
        debug.error('ui', 'Could not cancel the invite', err);
        return { ok: false };
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  return { sentInvitesLoad, retryLoad, send, cancel, refresh };
}
