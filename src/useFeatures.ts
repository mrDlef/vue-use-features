import { ref } from 'vue-demi';

const useFeatures = () => {
  const registry = ref(new Set());
  const registryEnabled = ref(new Set());

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
    return [...registry.value] as string[];
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

export default useFeatures;
