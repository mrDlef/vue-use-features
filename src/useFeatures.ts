import { getCurrentInstance, inject, provide, ref, type InjectionKey } from 'vue-demi';

export type Features = {
  enable: (flag: string) => void;
  disable: (flag: string) => void;
  isEnabled: (flag: string) => boolean;
  setFlags: (flags: string[]) => void;
  unregister: (flag: string) => void;
  all: () => string[];
};

/**
 * Builds an independent feature registry.
 *
 * Prefer `useFeatures()` in application code — this is the building block for
 * cases that need an isolated registry: tests, and one registry per request
 * under SSR (see `provideFeatures`).
 */
export const createFeatures = (): Features => {
  const registry = ref(new Set<string>());
  const registryEnabled = ref(new Set<string>());

  // Every mutation swaps in a fresh Set rather than mutating in place: Vue 2
  // cannot track mutations inside a Set, so replacing the ref's value is what
  // makes this reactive under both Vue 2 and Vue 3.
  const enable = (flag: string) => {
    const nextRegistry = new Set(registry.value);
    const nextEnabled = new Set(registryEnabled.value);
    nextRegistry.add(flag);
    nextEnabled.add(flag);
    registry.value = nextRegistry;
    registryEnabled.value = nextEnabled;
  };

  const disable = (flag: string) => {
    const nextRegistry = new Set(registry.value);
    const nextEnabled = new Set(registryEnabled.value);
    nextRegistry.add(flag);
    nextEnabled.delete(flag);
    registry.value = nextRegistry;
    registryEnabled.value = nextEnabled;
  };

  const isEnabled = (flag: string) => {
    return registryEnabled.value.has(flag);
  };

  const setFlags = (flags: string[]) => {
    const nextRegistry = new Set<string>();
    const nextEnabled = new Set<string>();
    for (const flag of flags) {
      nextRegistry.add(flag);
      nextEnabled.add(flag);
    }
    registry.value = nextRegistry;
    registryEnabled.value = nextEnabled;
  };

  const unregister = (flag: string) => {
    const nextRegistry = new Set(registry.value);
    const nextEnabled = new Set(registryEnabled.value);
    nextRegistry.delete(flag);
    nextEnabled.delete(flag);
    registry.value = nextRegistry;
    registryEnabled.value = nextEnabled;
  };

  const all = (): string[] => {
    return [...registry.value];
  };

  return {
    enable,
    disable,
    isEnabled,
    setFlags,
    unregister,
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

/**
 * Provides a registry to the current component tree, so `useFeatures()` below
 * it resolves to that registry instead of the module-level one.
 *
 * Must be called from `setup()`. Under SSR, call it in the root component with
 * a per-request registry so state never leaks between requests.
 */
export const provideFeatures = (features: Features = createFeatures()): Features => {
  provide(featuresInjectionKey, features);
  return features;
};

/**
 * Returns the registry for the current scope: the one provided by an ancestor
 * if there is one, otherwise the app-wide registry. Repeated calls see the
 * same flags.
 */
export const useFeatures = (): Features => {
  // `inject` is only valid during setup(); outside a component — a store, a
  // plain module — fall through to the app-wide registry instead of warning.
  if (getCurrentInstance()) {
    const provided = inject(featuresInjectionKey, null);
    if (provided) {
      return provided;
    }
  }

  return globalFeatures;
};

// Exported both ways on purpose: the default export is the documented entry
// point, and the named one spares UMD consumers a `vueUseFeatures.default()`.
export default useFeatures;
