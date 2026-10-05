import { useCallback, useEffect, useRef, useState } from 'react';
import { debug } from '@/lib/debug';

interface PollWhileVisibleOptions {
  intervalMs: number;
  /** False stops the timer, as once whatever was being waited for has arrived. */
  enabled: boolean;
}

interface PollWhileVisible {
  /** Polls at once, unless a poll is already running. For a "Check now" button. */
  checkNow: () => Promise<void>;
  /** True while a poll is running, whether the timer or `checkNow` started it. */
  isChecking: boolean;
}

/**
 * Calls `poll` every `intervalMs` while the tab is visible and `enabled` is true.
 *
 * Nobody is watching a hidden tab, so the timer stops when it is hidden. On
 * becoming visible again it polls at once, so a returning user never waits out
 * a full interval for news that may already be there, then resumes the timer.
 *
 * It does not poll when first enabled: the caller has usually just loaded the
 * same thing to decide that it needs to wait at all.
 *
 * Polls never overlap. A tick or a `checkNow` that lands while a poll is still
 * running is skipped, so a slow response cannot stack up requests behind it.
 *
 * `poll` should handle its own errors. A rejection from a timed poll has
 * nowhere to go, so it is logged through `debug` and dropped; one from
 * `checkNow` reaches whoever awaited it. Polling carries on either way.
 *
 * `poll` is handed an `AbortSignal` that aborts if the hook unmounts or
 * `enabled` turns false while that poll is still running. Nobody is waiting
 * for its answer any more, so `poll` should check `signal.aborted` before
 * acting on it (setting state, navigating). The signal does not cancel the
 * request itself: the `api` client's methods take no signal.
 *
 * `poll` need not be memoised: the latest one passed is always the one called.
 */
export function usePollWhileVisible(
  poll: (signal: AbortSignal) => Promise<void>,
  { intervalMs, enabled }: PollWhileVisibleOptions,
): PollWhileVisible {
  const [isChecking, setIsChecking] = useState(false);

  // The "latest ref" pattern: the timer reads the current `poll` through this
  // ref, so a new function each render does not restart the interval.
  const latestPoll = useRef(poll);
  useEffect(() => {
    latestPoll.current = poll;
  }, [poll]);

  // The running poll's abort controller, or null when no poll is running. A
  // ref, not state, because the skip decision has to be exact: two ticks in
  // the same render would both read a stale `isChecking` and both poll.
  const inFlightPoll = useRef<AbortController | null>(null);

  const runPoll = useCallback(async () => {
    if (inFlightPoll.current) return;
    const abortController = new AbortController();
    inFlightPoll.current = abortController;
    setIsChecking(true);
    try {
      await latestPoll.current(abortController.signal);
    } finally {
      inFlightPoll.current = null;
      setIsChecking(false);
    }
  }, []);

  // An abandoned poll still counts as in flight until it settles, so the next
  // one cannot overlap it.
  const abandonInFlightPoll = useCallback(() => {
    inFlightPoll.current?.abort();
  }, []);

  useEffect(() => {
    if (!enabled) abandonInFlightPoll();
  }, [enabled, abandonInFlightPoll]);

  useEffect(() => abandonInFlightPoll, [abandonInFlightPoll]);

  useEffect(() => {
    if (!enabled) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    // Nothing awaits a timed poll, so its rejection is logged here rather than
    // surfacing as an unhandled promise rejection. Logged, not swallowed: a
    // poll that throws on every tick would otherwise look like waiting.
    const runTimedPoll = () => {
      runPoll().catch((error: unknown) => {
        debug.error('ui', 'Timed poll failed', error);
      });
    };

    const startTimer = () => {
      intervalId = setInterval(runTimedPoll, intervalMs);
    };
    const stopTimer = () => {
      clearInterval(intervalId);
      intervalId = undefined;
    };

    const handleVisibilityChange = () => {
      stopTimer();
      if (document.visibilityState !== 'visible') return;
      runTimedPoll();
      startTimer();
    };

    if (document.visibilityState === 'visible') startTimer();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, runPoll]);

  return { checkNow: runPoll, isChecking };
}
