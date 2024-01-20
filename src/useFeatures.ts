import { ref } from "vue-demi";

const useFeatures = () => {
  const registry = ref(new Set());
  const registryEnabled = ref(new Set());

  const enable = (flag: string) => {
    registry.value.add(flag);
    registryEnabled.value.add(flag);
  };

  const disable = (flag: string) => {
    registry.value.add(flag);
    registryEnabled.value.delete(flag);
  };

  const isEnabled = (flag: string) => {
    return registryEnabled.value.has(flag);
  };

  const setFlags = (flags: string[]) => {
    registry.value.clear();
    flags.forEach(flag => {
      registry.value.add(flag);
      registryEnabled.value.add(flag);
    });
  }

  const unregister = (flag: string) => {
    registry.value.delete(flag);
    registryEnabled.value.delete(flag);
  }

  const all = (): string[] => {
    return [...registry.value] as string[];
  }

  return {
    enable,
    disable,
    isEnabled,
    setFlags,
    unregister,
    all,
  };
};

export default useFeatures;