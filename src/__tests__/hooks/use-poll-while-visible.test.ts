import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePollWhileVisible } from '@/hooks/use-poll-while-visible';
import { debug } from '@/lib/debug';

const INTERVAL_MS = 10_000;

let visibilityState: DocumentVisibilityState = 'visible';

/** Flips the tab's visibility and fires the event the browser would. */
function setVisibility(state: DocumentVisibilityState) {
  visibilityState = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Moves the fake clock on, letting any poll it starts settle inside `act`. */
async function advanceBy(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A poll that stays in flight until the test resolves it. */
function heldPoll() {
  let release = () => {};
  let latestSignal: AbortSignal | undefined;
  const poll = vi.fn((signal: AbortSignal) => {
    latestSignal = signal;
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  return { poll, release: () => release(), signal: () => latestSignal };
}

beforeEach(() => {
  vi.useFakeTimers();
  visibilityState = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePollWhileVisible', () => {
  it('polls once per interval while the tab is visible', async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }));

    await advanceBy(INTERVAL_MS - 1);
    expect(poll).not.toHaveBeenCalled();

    await advanceBy(1);
    expect(poll).toHaveBeenCalledTimes(1);

    await advanceBy(INTERVAL_MS * 2);
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it('does not poll while the tab is hidden', async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }));

    act(() => setVisibility('hidden'));
    await advanceBy(INTERVAL_MS * 3);

    expect(poll).not.toHaveBeenCalled();
  });

  it('does not start the timer if the tab is hidden when enabled', async () => {
    visibilityState = 'hidden';
    const poll = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }));

    await advanceBy(INTERVAL_MS * 3);

    expect(poll).not.toHaveBeenCalled();
  });

  it('polls at once on becoming visible, then resumes the interval from there', async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }));

    act(() => setVisibility('hidden'));
    await advanceBy(INTERVAL_MS * 3);
    act(() => setVisibility('visible'));
    await advanceBy(0);
    expect(poll).toHaveBeenCalledTimes(1);

    await advanceBy(INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('skips a tick while the previous poll is still running', async () => {
    const { poll, release } = heldPoll();
    renderHook(() => usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }));

    await advanceBy(INTERVAL_MS * 3);
    expect(poll).toHaveBeenCalledTimes(1);

    await act(async () => release());
    await advanceBy(INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('reports checking for as long as a poll runs', async () => {
    const { poll, release } = heldPoll();
    const { result } = renderHook(() =>
      usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }),
    );
    expect(result.current.isChecking).toBe(false);

    await advanceBy(INTERVAL_MS);
    expect(result.current.isChecking).toBe(true);

    await act(async () => release());
    expect(result.current.isChecking).toBe(false);
  });

  it('checks at once on checkNow, sharing the in-flight guard with the timer', async () => {
    const { poll, release } = heldPoll();
    const { result } = renderHook(() =>
      usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }),
    );

    act(() => void result.current.checkNow());
    expect(poll).toHaveBeenCalledTimes(1);
    expect(result.current.isChecking).toBe(true);

    act(() => void result.current.checkNow());
    await advanceBy(INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(1);

    await act(async () => release());
    expect(result.current.isChecking).toBe(false);
  });

  it('logs a rejection from a timed poll and keeps polling', async () => {
    const debugError = vi.spyOn(debug, 'error').mockImplementation(() => {});
    const failure = new Error('offline');
    const poll = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }),
    );

    // Were the rejection not caught, Vitest would fail the run on it.
    await advanceBy(INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(debugError).toHaveBeenCalledWith('ui', 'Timed poll failed', failure);
    expect(result.current.isChecking).toBe(false);

    await advanceBy(INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('logs a rejection from the poll made on becoming visible', async () => {
    const debugError = vi.spyOn(debug, 'error').mockImplementation(() => {});
    const failure = new Error('offline');
    const poll = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    renderHook(() => usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }));

    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await advanceBy(0);

    expect(poll).toHaveBeenCalledTimes(1);
    expect(debugError).toHaveBeenCalledWith('ui', 'Timed poll failed', failure);
  });

  it('keeps polling after a checkNow rejects', async () => {
    const poll = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }),
    );

    await act(async () => {
      await expect(result.current.checkNow()).rejects.toThrow('offline');
    });
    expect(result.current.isChecking).toBe(false);

    await advanceBy(INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('leaves the signal alone when a poll finishes normally', async () => {
    const { poll, release, signal } = heldPoll();
    renderHook(() => usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }));

    await advanceBy(INTERVAL_MS);
    await act(async () => release());

    expect(signal()?.aborted).toBe(false);
  });

  it('aborts the running poll on unmount', async () => {
    const { poll, signal } = heldPoll();
    const { unmount } = renderHook(() =>
      usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }),
    );

    await advanceBy(INTERVAL_MS);
    expect(signal()?.aborted).toBe(false);

    unmount();
    expect(signal()?.aborted).toBe(true);
  });

  it('aborts the running poll when disabled, and does not overlap it once enabled again', async () => {
    const { poll, release, signal } = heldPoll();
    const { rerender } = renderHook(
      ({ enabled }) => usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled }),
      { initialProps: { enabled: true } },
    );

    await advanceBy(INTERVAL_MS);
    rerender({ enabled: false });
    expect(signal()?.aborted).toBe(true);

    rerender({ enabled: true });
    await advanceBy(INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(1);

    await act(async () => release());
    await advanceBy(INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('restarts the timer at the new interval when intervalMs changes', async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ intervalMs }) => usePollWhileVisible(poll, { intervalMs, enabled: true }),
      { initialProps: { intervalMs: INTERVAL_MS } },
    );

    await advanceBy(INTERVAL_MS / 2);
    rerender({ intervalMs: INTERVAL_MS * 2 });

    await advanceBy(INTERVAL_MS * 2 - 1);
    expect(poll).not.toHaveBeenCalled();

    await advanceBy(1);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('does not poll while disabled, and stops when disabled later', async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ enabled }) => usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled }),
      { initialProps: { enabled: false } },
    );

    await advanceBy(INTERVAL_MS * 2);
    expect(poll).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await advanceBy(INTERVAL_MS);
    expect(poll).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    await advanceBy(INTERVAL_MS * 2);
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await advanceBy(0);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('stops polling on unmount', async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }),
    );

    unmount();
    await advanceBy(INTERVAL_MS * 2);

    expect(poll).not.toHaveBeenCalled();
  });

  it('calls the latest poll passed without restarting the interval', async () => {
    const firstPoll = vi.fn().mockResolvedValue(undefined);
    const secondPoll = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ poll }) => usePollWhileVisible(poll, { intervalMs: INTERVAL_MS, enabled: true }),
      { initialProps: { poll: firstPoll } },
    );

    await advanceBy(INTERVAL_MS / 2);
    rerender({ poll: secondPoll });
    await advanceBy(INTERVAL_MS / 2);

    expect(firstPoll).not.toHaveBeenCalled();
    expect(secondPoll).toHaveBeenCalledTimes(1);
  });
});
