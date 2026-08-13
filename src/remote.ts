import { ref, type Ref } from 'vue-demi';
import type { FeatureFlags, Features } from './useFeatures';

/**
 * Fetches the flag state from wherever it lives.
 *
 * No URL, no headers, no retries: this library does no I/O of its own, so the
 * request stays yours — your client, your auth, your abort signal. The resolved
 * value is a `FeatureFlags`, the same shape `setFlags` already accepts.
 */
export type FeatureLoader<Flag extends string = string> = () => Promise<FeatureFlags<Flag>>;

export type LoadFeaturesOptions<Flag extends string = string> = {
  /**
   * Flags the payload must never touch. Pass what `applyQueryFlags` returned:
   * a deliberate override has to survive a load that resolves after it.
   */
  pinned?: Flag[];
};

export type RemoteFeatures = {
  /** True while a load is in flight, so a call site can tell "off" from "not known yet". */
  isLoading: Readonly<Ref<boolean>>;
  /** What the last load threw, or `undefined` after one succeeds. */
  error: Readonly<Ref<unknown>>;
  /** The first load. Await it under SSR, or to hold rendering until flags are known. */
  ready: Promise<void>;
  /** Loads again. Never rejects — failures land in `error`. */
  refresh: () => Promise<void>;
  /** Stops applying results. In-flight responses are dropped, not awaited. */
  stop: () => void;
};

/**
 * Turns a loader's payload into a flag map, rejecting anything else.
 *
 * The loader is typed, but what it resolves to is a backend response — external
 * input, exactly like the stored state in `persistFeatures`. Only strings in an
 * array and booleans in a map survive, so a half-migrated or hand-rolled
 * payload cannot register nonsense flags in the application.
 */
const normalise = <Flag extends string>(payload: unknown): Partial<Record<Flag, boolean>> => {
  if (payload === null || typeof payload !== 'object') {
    throw new TypeError(
      `[vue-use-features] the loader must resolve to an array or an object, received ${typeof payload}`
    );
  }

  const flags = {} as Partial<Record<Flag, boolean>>;

  if (Array.isArray(payload)) {
    // An array lists the enabled flags, matching `setFlags`.
    for (const flag of payload) {
      if (typeof flag === 'string' && flag) {
        flags[flag as Flag] = true;
      }
    }
    return flags;
  }

  for (const [flag, value] of Object.entries(payload)) {
    if (typeof value === 'boolean' && flag) {
      flags[flag as Flag] = value;
    }
  }
  return flags;
};

/**
 * Loads flags into a registry from a backend, and keeps a handle on that load.
 *
 * The payload is authoritative: each load replaces the registry, so a flag
 * retired server-side actually disappears. The exception is `pinned`, whose
 * current state is carried across untouched.
 *
 * Starts loading immediately. Call it last, after the synchronous layers, and
 * pin what the query string overrode:
 *
 * ```ts
 * const features = useFeatures()
 * features.setFlags({ 'new-navbar': false })   // what holds until flags arrive
 * persistFeatures(features)                    // last known state, synchronous
 * const pinned = applyQueryFlags(features)     // debug overrides
 * const { isLoading } = loadFeatures(features, () => fetch('/api/flags').then((r) => r.json()), {
 *   pinned
 * })
 * ```
 *
 * Paired with `persistFeatures`, the payload is written to storage, so the next
 * reload starts on the last known flags rather than on the defaults — the flags
 * do not visibly flip once the request lands.
 *
 * A failed load leaves the registry alone: whatever the defaults, the stored
 * state and the query string put there stays, and the reason lands in `error`.
 */
export const loadFeatures = <Flag extends string>(
  features: Features<Flag>,
  load: FeatureLoader<Flag>,
  options: LoadFeaturesOptions<Flag> = {}
): RemoteFeatures => {
  const pinned = options.pinned ?? [];
  const isLoading = ref(false);
  const error = ref<unknown>(undefined);

  // Guards against an overlapping `refresh()`: only the newest call may write,
  // so the slowest response cannot win over a later one.
  let sequence = 0;
  let stopped = false;

  const apply = (payload: FeatureFlags<Flag>) => {
    const flags = normalise<Flag>(payload);

    // Read the pinned flags now rather than at setup: pinning means the remote
    // never touches them, including after a manual toggle.
    for (const flag of pinned) {
      if (features.isRegistered(flag)) {
        flags[flag] = features.isEnabled(flag);
      }
    }

    // One `setFlags` rather than a replace followed by fixups: the registry
    // swaps its Sets on every write, and a single write is a single update.
    features.setFlags(flags);
  };

  const refresh = async (): Promise<void> => {
    if (stopped) {
      return;
    }

    const token = ++sequence;
    isLoading.value = true;

    try {
      const payload = await load();
      // `apply` throws on a malformed payload, which is a load failure like any
      // other -- the registry is left as it was.
      if (!stopped && token === sequence) {
        apply(payload);
        error.value = undefined;
      }
    } catch (cause) {
      if (!stopped && token === sequence) {
        error.value = cause;
      }
    } finally {
      // Only the newest call owns `isLoading`; a superseded one leaving it false
      // would report idle while a request is still out.
      if (!stopped && token === sequence) {
        isLoading.value = false;
      }
    }
  };

  const stop = () => {
    stopped = true;
    isLoading.value = false;
  };

  // `refresh` swallows its failures, so this never becomes an unhandled
  // rejection for callers who ignore `ready`.
  const ready = refresh();

  return { isLoading, error, ready, refresh, stop };
};
