import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  CloudOff,
  Hourglass,
  Loader2,
  MailX,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { JoinHouseholdStep } from '@/components/account/join-household-step';
import { SafetyNumbers } from '@/components/account/safety-numbers';
import { useAuth } from '@/hooks/use-auth';
import { usePollWhileVisible } from '@/hooks/use-poll-while-visible';
import { useSync } from '@/hooks/use-sync';
import { api, ApiError, type KeyBundle, type RewrapBody } from '@/lib/api-client';
import {
  completeHandoff,
  HandoffRefusedError,
  markPublicKeyConfirmed,
  WrongPasswordError,
  WrongPhraseError,
  type ConfirmedHandoff,
} from '@/lib/account';
import { base64urlToBytes } from '@/lib/base64url';
import { downloadBackup } from '@/lib/backup-download';
import { debug } from '@/lib/debug';
import {
  classifyHandoffState,
  classifyRewrapFailure,
  findJoiningInvite,
  type RewrapFailure,
} from '@/lib/invite-acceptance';
import { safetyNumberFor } from '@/lib/key-management';
import { unlockKeyVault } from '@/lib/key-vault';
import { cn } from '@/lib/utils';

/** Every 10 s is 6 a minute against `/auth/key-bundle`'s 30 per user. */
const POLL_INTERVAL_MS = 10_000;

const UNEXPECTED_JOIN_FAILURE = 'Something went wrong while joining. Please try again.';

/** What every screen past loading shows, read once from the key bundle and invite list. */
interface WaitingContext {
  bundle: KeyBundle;
  ownSafetyNumber: string;
  /** Null when the invite list could not be read, or holds no invite to join through. */
  senderEmail: string | null;
}

/** A handoff that has arrived and not yet been checked against its safety number. */
interface UnconfirmedHandoff {
  senderPubkey: string;
  wrappedMasterKey: string;
  senderSafetyNumber: string;
}

/**
 * - `awaiting`: no key handed over yet. Polls, unless the invite was cancelled.
 * - `cannot-verify`: a key arrived with no sender key to check it against.
 * - `compare` and `mismatch`: a key arrived, waiting on the safety numbers.
 * - `join`: the numbers matched; the password and phrase form.
 * - `download-failed`: joined, but the shared budget has not downloaded.
 */
type Screen =
  | { kind: 'loading' }
  | { kind: 'load-failed' }
  | { kind: 'awaiting'; context: WaitingContext; inviteStillOpen: boolean }
  | { kind: 'cannot-verify'; context: WaitingContext }
  | { kind: 'compare'; context: WaitingContext; handoff: UnconfirmedHandoff }
  | { kind: 'mismatch'; context: WaitingContext; handoff: UnconfirmedHandoff }
  | {
      kind: 'join';
      context: WaitingContext;
      handoff: ConfirmedHandoff;
      joining: boolean;
      error: string | null;
    }
  | { kind: 'download-failed'; retrying: boolean };

/**
 * The screen a key bundle puts this account on, or `already-member` when it
 * has nothing to wait for and belongs at the ordinary unlock.
 *
 * The invite list is read for the sender's address and to tell a cancelled
 * invite from a slow one, on every poll as well as on entry, since a sender
 * can cancel while the invitee waits.
 *
 * If it cannot be read, the screen still works. The invite is assumed open
 * rather than telling someone it was cancelled on the strength of a failed
 * request, and the sender keeps the address the last good read found, so one
 * failed poll does not flip the heading to "the person who invited you" and
 * back.
 */
async function screenFor(
  bundle: KeyBundle,
  previousSenderEmail: string | null,
): Promise<Screen | { kind: 'already-member' }> {
  const handoffState = classifyHandoffState(bundle);
  if (handoffState === 'member') return { kind: 'already-member' };

  if (!bundle.user.pubkey) {
    throw new Error('This account has no public key to show a safety number for.');
  }

  const [ownSafetyNumber, received] = await Promise.all([
    safetyNumberFor(base64urlToBytes(bundle.user.pubkey)),
    api.invites
      .list()
      .then((invites) => invites.received)
      .catch(() => null),
  ]);
  const joiningInvite = received ? findJoiningInvite(received) : null;
  const context: WaitingContext = {
    bundle,
    ownSafetyNumber,
    senderEmail: received ? (joiningInvite?.senderEmail ?? null) : previousSenderEmail,
  };

  if (handoffState === 'awaiting-handoff') {
    return { kind: 'awaiting', context, inviteStillOpen: received === null || !!joiningInvite };
  }

  const handoffRow = bundle.memberKeys.find((row) => row.kekKind === 'ecies');
  if (!handoffRow?.senderPubkey) return { kind: 'cannot-verify', context };

  return {
    kind: 'compare',
    context,
    handoff: {
      senderPubkey: handoffRow.senderPubkey,
      wrappedMasterKey: handoffRow.wrappedMasterKey,
      senderSafetyNumber: await safetyNumberFor(base64urlToBytes(handoffRow.senderPubkey)),
    },
  };
}

const REWRAP_FAILURE_WORDING: Record<RewrapFailure['kind'], string> = {
  'rate-limited':
    'You have tried to join too many times in the last hour. Wait an hour, then try again.',
  'already-joined':
    'Something changed while you were joining. Reload this page to see where things stand.',
  'stale-key-bundle':
    'Your account changed since this page opened, perhaps because your password was changed on another device. Enter your current password and recovery phrase again.',
  // Covers a dropped connection and a server error alike, so it claims neither.
  other: 'We could not finish joining. Please try again.',
};

/**
 * Upload the rewrap. Resolves to null once this account is a member, or to the
 * sentence to show and the freshest key bundle known.
 *
 * Any failure but the rate limit re-reads the bundle before reporting it,
 * because a rewrap can land and still fail on the way back. The first success
 * deletes the handoff row, so a retry would answer `NO_PENDING_HANDOFF`; the
 * bundle shows a `pwd` row instead, and the keys in hand are still the right
 * ones.
 */
async function uploadRewrap(
  bundle: KeyBundle,
  householdId: string,
  body: RewrapBody,
): Promise<{ error: string; bundle: KeyBundle } | null> {
  try {
    await api.households.rewrapMemberKeys(householdId, bundle.user.id, body);
    return null;
  } catch (err) {
    const failure = classifyRewrapFailure(err);
    if (failure.kind === 'rate-limited') {
      return { error: REWRAP_FAILURE_WORDING[failure.kind], bundle };
    }

    const freshBundle = await api.auth.keyBundle().catch(() => null);
    if (freshBundle && classifyHandoffState(freshBundle) === 'member') return null;

    debug.error('ui', 'Rewrap failed', err);
    return { error: REWRAP_FAILURE_WORDING[failure.kind], bundle: freshBundle ?? bundle };
  }
}

/**
 * Where an invitee waits for the household key, checks it, and joins.
 *
 * Reached after invite signup, and from any sign-in by an account still short
 * of membership (`classifyHandoffState`). Everything it shows is read from the
 * key bundle, so a reload always lands on the right screen.
 *
 * Joining runs `completeHandoff` (locally, so a typo spends nothing), then the
 * rewrap upload (three an hour), then unlocks the keys, then pulls the shared
 * budget. The keys are unlocked only after the upload, as `completeHandoff`
 * requires.
 *
 * Outside the app shell, so sign out is offered on every screen but the join
 * in progress: without it the page is a dead end.
 */
export function HouseholdWaitingPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { pull } = useSync();
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  // Bumped by Try again, so the load effect runs afresh with its own abort.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const senderEmail = 'context' in screen ? screen.context.senderEmail : null;

  /**
   * Show the screen a bundle puts this account on. Every read here can resolve
   * after the page has moved on (an unmount, StrictMode's second effect run, a
   * poll abandoned when the invite closed), so nothing is shown or navigated
   * to once `signal` has aborted.
   */
  const showScreenFor = useCallback(
    async (bundle: KeyBundle, signal: AbortSignal, previousSenderEmail: string | null) => {
      const nextScreen = await screenFor(bundle, previousSenderEmail);
      if (signal.aborted) return;
      if (nextScreen.kind === 'already-member') {
        // The sign-in page shows a member the unlock prompt.
        navigate('/login', { replace: true });
        return;
      }
      setScreen(nextScreen);
    },
    [navigate],
  );

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    const load = async () => {
      try {
        const bundle = await api.auth.keyBundle();
        if (signal.aborted) return;
        // Nothing has been read yet, so there is no earlier address to keep.
        await showScreenFor(bundle, signal, null);
      } catch (err) {
        if (signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        debug.error('ui', 'Could not load the waiting screen', err);
        setScreen({ kind: 'load-failed' });
      }
    };
    void load();

    return () => abortController.abort();
  }, [loadAttempt, navigate, showScreenFor]);

  const handleRetryLoad = () => {
    setScreen({ kind: 'loading' });
    setLoadAttempt((attempt) => attempt + 1);
  };

  // Each poll re-reads the invite list as well as the bundle (through
  // `screenFor`), so an invite cancelled while this page is open shows as
  // cancelled within one interval. The list allows 30 a minute per user, the
  // same as the bundle, so both at 6 a minute is well inside.
  const { checkNow, isChecking } = usePollWhileVisible(
    async (signal) => {
      let bundle: KeyBundle;
      try {
        bundle = await api.auth.keyBundle();
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError && err.status === 401) {
          navigate('/login', { replace: true });
        }
        // Anything else is likely a blip; the next poll tries again.
        return;
      }
      if (signal.aborted) return;

      try {
        await showScreenFor(bundle, signal, senderEmail);
      } catch (err) {
        debug.error('ui', 'Could not refresh the waiting screen', err);
      }
    },
    {
      intervalMs: POLL_INTERVAL_MS,
      enabled: screen.kind === 'awaiting' && screen.inviteStillOpen,
    },
  );

  const handleNumbersMatch = () => {
    if (screen.kind !== 'compare') return;
    setScreen({
      kind: 'join',
      context: screen.context,
      handoff: {
        // The key the displayed number was computed from, and only that key.
        senderPubkey: markPublicKeyConfirmed(screen.handoff.senderPubkey),
        wrappedMasterKey: screen.handoff.wrappedMasterKey,
      },
      joining: false,
      error: null,
    });
  };

  const handleNumbersDiffer = () => {
    if (screen.kind !== 'compare') return;
    setScreen({ kind: 'mismatch', context: screen.context, handoff: screen.handoff });
  };

  const handleCompareAgain = () => {
    if (screen.kind !== 'mismatch') return;
    setScreen({ kind: 'compare', context: screen.context, handoff: screen.handoff });
  };

  const handleDownloadBackup = async () => {
    try {
      await downloadBackup();
    } catch (err) {
      debug.error('db', 'Backup before joining failed', err);
      toast.error('Could not create the backup. Please try again.');
    }
  };

  const downloadSharedBudget = async () => {
    try {
      await pull();
    } catch (err) {
      // Stay here rather than navigate: an empty device would be bounced into
      // the setup wizard, which would start a budget of its own.
      debug.error('ui', 'Pull after joining failed', err);
      setScreen({ kind: 'download-failed', retrying: false });
      return;
    }
    navigate('/cash-flow', { replace: true });
  };

  const handleRetryDownload = async () => {
    setScreen({ kind: 'download-failed', retrying: true });
    await downloadSharedBudget();
  };

  const handleJoin = async (password: string, recoveryPhrase: string) => {
    if (screen.kind !== 'join') return;
    const { context, handoff } = screen;
    const showJoinError = (error: string, bundle: KeyBundle = context.bundle) => {
      setScreen({
        kind: 'join',
        context: { ...context, bundle },
        handoff,
        joining: false,
        error,
      });
    };

    // Checked before `completeHandoff`, so a missing household does not cost
    // a key derivation first. A bundle in this state always carries one.
    const householdId = context.bundle.household?.id;
    if (!householdId) {
      showJoinError(UNEXPECTED_JOIN_FAILURE);
      return;
    }

    setScreen({ ...screen, joining: true, error: null });

    let rewrap: Awaited<ReturnType<typeof completeHandoff>>;
    try {
      rewrap = await completeHandoff({ password, recoveryPhrase }, context.bundle, handoff);
    } catch (err) {
      if (
        err instanceof WrongPhraseError ||
        err instanceof WrongPasswordError ||
        err instanceof HandoffRefusedError
      ) {
        showJoinError(err.message);
        return;
      }
      debug.error('ui', 'Opening the handoff failed', err);
      showJoinError(UNEXPECTED_JOIN_FAILURE);
      return;
    }

    const uploadFailure = await uploadRewrap(context.bundle, householdId, rewrap.body);
    if (uploadFailure) {
      showJoinError(uploadFailure.error, uploadFailure.bundle);
      return;
    }

    unlockKeyVault(rewrap.keys);
    await downloadSharedBudget();
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      toast.error('Could not sign you out. Please try again.');
      setSigningOut(false);
      return;
    }
    navigate('/welcome', { replace: true });
  };

  const isJoining = screen.kind === 'join' && screen.joining;
  const senderName = senderEmail ?? 'The person who invited you';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        {screen.kind === 'loading' && (
          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            One moment...
          </p>
        )}

        {screen.kind === 'load-failed' && (
          <>
            <ScreenHeading
              icon={<CloudOff className="h-6 w-6 text-blue-500" />}
              title="We could not load your invite"
            >
              Check your connection and try again.
            </ScreenHeading>
            <Button className="w-full" onClick={handleRetryLoad}>
              Try again
            </Button>
          </>
        )}

        {screen.kind === 'awaiting' && screen.inviteStillOpen && (
          <>
            <ScreenHeading
              icon={<Hourglass className="h-6 w-6 text-blue-500" />}
              title="Waiting to join"
            >
              {senderName} needs to approve you before you can see the shared budget. To do that,
              they will be shown your safety number. Read yours out to them, in person or on a call,
              so they can check it matches.
            </ScreenHeading>
            <SafetyNumbers yours={screen.context.ownSafetyNumber} theirs={null} />
            <div className="space-y-2 text-center">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void checkNow()}
                disabled={isChecking}
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Check now
              </Button>
              <p className="text-sm text-muted-foreground">
                This page checks every few seconds, so you can leave it open.
              </p>
            </div>
          </>
        )}

        {screen.kind === 'awaiting' && !screen.inviteStillOpen && (
          <ScreenHeading
            icon={<MailX className="h-6 w-6 text-blue-500" />}
            title="This invite is no longer open"
          >
            The invite you accepted has been cancelled. Ask the person who invited you to send a new
            one, then open the link in the new email.
          </ScreenHeading>
        )}

        {screen.kind === 'cannot-verify' && (
          <ScreenHeading
            icon={<ShieldAlert className="h-6 w-6 text-destructive" />}
            iconBackground="bg-destructive/10"
            title="This invite cannot be opened"
          >
            There is no way to check who sent this invite, so it cannot be opened safely. Get in
            touch with the person who invited you.
          </ScreenHeading>
        )}

        {screen.kind === 'compare' && (
          <>
            <ScreenHeading
              icon={<ShieldCheck className="h-6 w-6 text-blue-500" />}
              title="Check the safety numbers"
            >
              {senderName} has approved you. Ask them to read out the safety number on their screen,
              and check it matches theirs below. Do this in person or on a call, not by email or
              message.
            </ScreenHeading>
            <SafetyNumbers
              yours={screen.context.ownSafetyNumber}
              theirs={{
                label: senderEmail ? `${senderEmail}'s` : 'Theirs',
                safetyNumber: screen.handoff.senderSafetyNumber,
              }}
            />
            <div className="space-y-2">
              <Button className="w-full" onClick={handleNumbersMatch}>
                The numbers match
              </Button>
              <Button variant="outline" className="w-full" onClick={handleNumbersDiffer}>
                They do not match
              </Button>
            </div>
          </>
        )}

        {screen.kind === 'mismatch' && (
          <>
            <ScreenHeading
              icon={<ShieldAlert className="h-6 w-6 text-destructive" />}
              iconBackground="bg-destructive/10"
              title="Do not join yet"
            >
              <p>
                The numbers did not match, so the shared budget has not been opened. Someone may be
                interfering with the connection between you, or a number may have been misread.
              </p>
              <p className="mt-3">
                Contact {senderEmail ?? 'the person who invited you'} another way, such as a phone
                call, and compare again together. Nothing has changed, so you can compare again
                whenever you are ready.
              </p>
            </ScreenHeading>
            <Button variant="outline" className="w-full" onClick={handleCompareAgain}>
              Compare again
            </Button>
          </>
        )}

        {screen.kind === 'join' && (
          <JoinHouseholdStep
            senderEmail={senderEmail}
            onJoin={(password, recoveryPhrase) => void handleJoin(password, recoveryPhrase)}
            onDownloadBackup={() => void handleDownloadBackup()}
            joining={screen.joining}
            error={screen.error}
          />
        )}

        {screen.kind === 'download-failed' && (
          <>
            <ScreenHeading
              icon={<CloudOff className="h-6 w-6 text-blue-500" />}
              title="You have joined"
            >
              The shared budget has not downloaded to this device yet. Check your connection and try
              again.
            </ScreenHeading>
            <Button
              className="w-full"
              onClick={() => void handleRetryDownload()}
              disabled={screen.retrying}
            >
              {screen.retrying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                'Try again'
              )}
            </Button>
          </>
        )}

        {screen.kind !== 'loading' && !isJoining && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="cursor-pointer text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:cursor-not-allowed"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The icon bubble, heading and muted body every screen here opens with. */
function ScreenHeading({
  icon,
  iconBackground = 'bg-blue-500/10',
  title,
  children,
}: {
  icon: ReactNode;
  iconBackground?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className={cn('mb-4 rounded-full p-3', iconBackground)}>{icon}</div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </div>
  );
}
