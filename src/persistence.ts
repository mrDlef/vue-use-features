import { watch } from 'vue-demi';
import type { Features } from './useFeatures';

export type PersistOptions = {
  /** Storage key. Defaults to `vue-use-features`. */
  key?: string;
  /**
   * Where to store. Defaults to `localStorage` when it exists — pass
   * `sessionStorage`, or anything with the same shape, to override.
   */
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
};

/** Call to stop persisting. Safe to call more than once. */
export type StopPersisting = () => void;

const DEFAULT_KEY = 'vue-use-features';

const defaultStorage = (): PersistOptions['storage'] => {
  // Guarded rather than assumed: this module has to be importable under SSR,
  // and Safari throws on `localStorage` access in some privacy modes.
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

const readStored = (
  storage: NonNullable<PersistOptions['storage']>,
  key: string
): Record<string, boolean> | undefined => {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return undefined;
  }
  if (raw === null) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }

    // Only booleans survive. A hand-edited or half-migrated payload should not
    // be able to register nonsense flags in the application.
    const state: Record<string, boolean> = {};
    for (const [flag, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') {
        state[flag] = value;
      }
    }
    return state;
  } catch {
    return undefined;
  }
};

/**
 * Restores a registry from storage, then writes it back on every change.
 *
 * Call once, at startup, before applying anything that should win over the
 * stored state — query-string overrides in particular:
 *
 * ```ts
 * const features = useFeatures()
 * persistFeatures(features)
 * applyQueryFlags(features)
 * ```
 *
 * A no-op when no storage is available, so it is safe to call under SSR.
 */
export const persistFeatures = <Flag extends string>(
  features: Features<Flag>,
  options: PersistOptions = {}
): StopPersisting => {
  const key = options.key ?? DEFAULT_KEY;
  const storage = options.storage ?? defaultStorage();

  if (!storage) {
    return () => undefined;
  }

  const stored = readStored(storage, key);
  if (stored) {
    features.setFlags(stored as Partial<Record<Flag, boolean>>);
  }

  // The getter returns a fresh object every run, so every registry change
  // triggers the write -- no `deep` needed.
  return watch(
    () => features.snapshot(),
    (state) => {
      try {
        storage.setItem(key, JSON.stringify(state));
      } catch {
        // Full quota or a denied write should not take the application down;
        // the flags stay correct in memory, they just will not survive a reload.
      }
    },
    { immediate: true }
  );
};
