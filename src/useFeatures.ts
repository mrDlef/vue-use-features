import {
  computed,
  getCurrentInstance,
  inject,
  provide,
  shallowRef,
  type InjectionKey,
  type WritableComputedRef
} from 'vue-demi';

/**
 * Initial state accepted by `setFlags`: a list of flags to register and enable,
 * or a map when you need a mix of enabled and disabled flags.
 */
export type FeatureFlags<Flag extends string = string> = Flag[] | Partial<Record<Flag, boolean>>;

export type Features<Flag extends string = string> = {
  enable: (flag: Flag) => void;
  disable: (flag: Flag) => void;
  /** Flips a flag and returns its new state. Registers it if unknown. */
  toggle: (flag: Flag) => boolean;
  isEnabled: (flag: Flag) => boolean;
  /** Whether the flag is known at all, enabled or not. */
  isRegistered: (flag: Flag) => boolean;
  /** Two-way reactive view of one flag, for `v-model` and watchers. */
  feature: (flag: Flag) => WritableComputedRef<boolean>;
  setFlags: (flags: FeatureFlags<Flag>) => void;
  unregister: (flag: Flag) => void;
  /** Forgets every flag. */
  reset: () => void;
  all: () => Flag[];
};

/**
 * Builds an independent feature registry.
 *
 * Prefer `useFeatures()` in application code — this is the building block for
 * cases that need an isolated registry: tests, and one registry per request
 * under SSR (see `provideFeatures`).
 *
 * Pass a union of flag names to have TypeScript check them at every call site:
 * `createFeatures<'new-navbar' | 'beta-settings'>()`.
 */
export const createFeatures = <Flag extends string = string>(): Features<Flag> => {
  const registry = shallowRef(new Set<Flag>());
  const registryEnabled = shallowRef(new Set<Flag>());

  // Every mutation swaps in a fresh Set rather than mutating in place: Vue 2
  // cannot track mutations inside a Set, so replacing the ref's value is what
  // makes this reactive under both Vue 2 and Vue 3. `shallowRef` follows from
  // that -- deep reactivity would wrap a Set that is never mutated in place,
  // and it would also make `ref` widen `Set<Flag>` to `Set<UnwrapRefSimple<Flag>>`.
  const write = (nextRegistry: Set<Flag>, nextEnabled: Set<Flag>) => {
    registry.value = nextRegistry;
    registryEnabled.value = nextEnabled;
  };

  const enable = (flag: Flag) => {
    const nextRegistry = new Set(registry.value);
    const nextEnabled = new Set(registryEnabled.value);
    nextRegistry.add(flag);
    nextEnabled.add(flag);
    write(nextRegistry, nextEnabled);
  };

  const disable = (flag: Flag) => {
    const nextRegistry = new Set(registry.value);
    const nextEnabled = new Set(registryEnabled.value);
    nextRegistry.add(flag);
    nextEnabled.delete(flag);
    write(nextRegistry, nextEnabled);
  };

  const isEnabled = (flag: Flag) => {
    return registryEnabled.value.has(flag);
  };

  const isRegistered = (flag: Flag) => {
    return registry.value.has(flag);
  };

  const toggle = (flag: Flag) => {
    const next = !isEnabled(flag);
    if (next) {
      enable(flag);
    } else {
      disable(flag);
    }
    return next;
  };

  const feature = (flag: Flag): WritableComputedRef<boolean> =>
    computed({
      get: () => isEnabled(flag),
      set: (value: boolean) => {
        if (value) {
          enable(flag);
        } else {
          disable(flag);
        }
      }
    });

  const setFlags = (flags: FeatureFlags<Flag>) => {
    const nextRegistry = new Set<Flag>();
    const nextEnabled = new Set<Flag>();

    if (Array.isArray(flags)) {
      for (const flag of flags) {
        nextRegistry.add(flag);
        nextEnabled.add(flag);
      }
    } else {
      // A map registers every key, and only enables the truthy ones -- the way
      // to declare an initial state where some flags start off.
      for (const [flag, enabled] of Object.entries(flags) as [Flag, boolean | undefined][]) {
        nextRegistry.add(flag);
        if (enabled) {
          nextEnabled.add(flag);
        }
      }
    }

    write(nextRegistry, nextEnabled);
  };

  const unregister = (flag: Flag) => {
    const nextRegistry = new Set(registry.value);
    const nextEnabled = new Set(registryEnabled.value);
    nextRegistry.delete(flag);
    nextEnabled.delete(flag);
    write(nextRegistry, nextEnabled);
  };

  const reset = () => {
    write(new Set<Flag>(), new Set<Flag>());
  };

  const all = (): Flag[] => {
    return [...registry.value];
  };

  return {
    enable,
    disable,
    toggle,
    isEnabled,
    isRegistered,
    feature,
    setFlags,
    unregister,
    reset,
    all
  };
};

export const featuresInjectionKey: InjectionKey<Features> = Symbol('vue-use-features');

/**
 * Registry used when nothing has been provided to the component tree.
 *
 * Module-level on purpose: a feature toggle is only useful if enabling it in
 * one component is visible from every other one. The trade-off is that it is
 * shared across every request in an SSR process — use `provideFeatures` there.
 */
const globalFeatures = createFeatures();

// The registry never inspects flag names, so narrowing `Flag` is purely a
// compile-time concern: `Features<string>` and `Features<'a' | 'b'>` are the
// same object at runtime. TypeScript rejects the direct cast because `enable`
// and `all` vary in opposite directions, hence going through `unknown`.
const asFeatures = <Flag extends string>(features: Features<string>): Features<Flag> =>
  features as unknown as Features<Flag>;

/**
 * Provides a registry to the current component tree, so `useFeatures()` below
 * it resolves to that registry instead of the module-level one.
 *
 * Must be called from `setup()`. Under SSR, call it in the root component with
 * a per-request registry so state never leaks between requests.
 */
export const provideFeatures = <Flag extends string = string>(
  features: Features<Flag> = createFeatures<Flag>()
): Features<Flag> => {
  provide(featuresInjectionKey, features as unknown as Features<string>);
  return features;
};

/**
 * Returns the registry for the current scope: the one provided by an ancestor
 * if there is one, otherwise the app-wide registry. Repeated calls see the
 * same flags.
 */
export const useFeatures = <Flag extends string = string>(): Features<Flag> => {
  // `inject` is only valid during setup(); outside a component — a store, a
  // plain module — fall through to the app-wide registry instead of warning.
  if (getCurrentInstance()) {
    const provided = inject(featuresInjectionKey, null);
    if (provided) {
      return asFeatures<Flag>(provided);
    }
  }

  return asFeatures<Flag>(globalFeatures);
};

// Exported both ways on purpose: the default export is the documented entry
// point, and the named one spares UMD consumers a `vueUseFeatures.default()`.
export default useFeatures;
