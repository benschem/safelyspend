/**
 * Centralized storage key constants for localStorage.
 * Main data is stored in IndexedDB via Dexie (see db.ts).
 * These keys are for preferences and sync events only.
 */
export const STORAGE_KEYS = {
  /** View state preferences (date range, etc.) */
  VIEW_STATE: 'budget:viewState',
  /** Theme preference */
  THEME: 'budget:theme',
  /** Demo persona selection */
  DEMO_PERSONA: 'budget:demoPersonaId',
  /** Check-in nudge dismissed */
  CHECKIN_NUDGE_DISMISSED: 'budget:checkInNudgeDismissed',
  /** Cloud sync: local vault version */
  SYNC_LOCAL_VERSION: 'budget:syncLocalVersion',
  /** Cloud sync: last synced timestamp */
  SYNC_LAST_SYNCED_AT: 'budget:syncLastSyncedAt',
} as const;

/** Event name for cross-tab storage sync */
export const STORAGE_SYNC_EVENT = 'budget:storage-sync';
