import { beforeEach, describe, expect, test } from 'vitest';
import { computed, defineComponent, h, isVue2 } from 'vue-demi';
import { mount } from '@vue/test-utils';
import useFeatures, {
  createFeatures,
  featuresInjectionKey,
  provideFeatures,
  type Features
} from '@/useFeatures';

// Behaviour is exercised through `createFeatures()` so each test owns its
// registry. `useFeatures()` deliberately returns a shared one — see the
// "registry scoping" block below.
//
// Every test here starts from a fresh registry, so an assertion that only
// checks a "negative" outcome (`isEnabled` false, `all()` empty) would pass
// against a no-op implementation. Each negative assertion is therefore
// preceded by a positive one on the same flag.

describe('enable', () => {
  test('it registers and enables a flag', () => {
    const { enable, isEnabled, all } = createFeatures();

    enable('test');

    expect(isEnabled('test')).toBe(true);
    expect(all()).toEqual(['test']);
  });

  test('it re-enables a previously disabled flag', () => {
    const { enable, disable, isEnabled } = createFeatures();

    enable('test');
    disable('test');
    expect(isEnabled('test')).toBe(false);

    enable('test');

    expect(isEnabled('test')).toBe(true);
  });

  test('it leaves other flags untouched', () => {
    const { enable, disable, isEnabled, all } = createFeatures();

    disable('other');
    enable('test');

    expect(isEnabled('test')).toBe(true);
    expect(isEnabled('other')).toBe(false);
    expect(all()).toEqual(['other', 'test']);
  });
});

describe('disable', () => {
  test('it turns an enabled flag off', () => {
    const { enable, disable, isEnabled } = createFeatures();

    enable('test');
    expect(isEnabled('test')).toBe(true);

    disable('test');

    expect(isEnabled('test')).toBe(false);
  });

  test('it registers an unknown flag while leaving it disabled', () => {
    const { disable, isEnabled, all } = createFeatures();

    disable('test');

    // Documented behaviour: `disable` registers the flag so it shows up in
    // `all()` — this is what makes a flag listable before it is turned on.
    expect(all()).toEqual(['test']);
    expect(isEnabled('test')).toBe(false);
  });

  test('it leaves other enabled flags untouched', () => {
    const { enable, disable, isEnabled } = createFeatures();

    enable('kept');
    enable('test');

    disable('test');

    expect(isEnabled('kept')).toBe(true);
    expect(isEnabled('test')).toBe(false);
  });
});

describe('isEnabled', () => {
  test('it returns false for a flag that was never registered', () => {
    const { enable, isEnabled } = createFeatures();

    enable('registered');

    expect(isEnabled('registered')).toBe(true);
    expect(isEnabled('never-seen')).toBe(false);
  });
});

describe('setFlags', () => {
  test('it registers and enables every flag passed', () => {
    const { setFlags, isEnabled, all } = createFeatures();

    setFlags(['a', 'b']);

    expect(isEnabled('a')).toBe(true);
    expect(isEnabled('b')).toBe(true);
    expect(all()).toEqual(['a', 'b']);
  });

  test('it replaces the registry instead of merging into it', () => {
    const { enable, setFlags, isEnabled, all } = createFeatures();

    enable('old');
    expect(isEnabled('old')).toBe(true);

    setFlags(['new']);

    expect(all()).toEqual(['new']);
    expect(isEnabled('old')).toBe(false);
  });

  test('it clears the registry when passed an empty list', () => {
    const { enable, setFlags, all } = createFeatures();

    enable('old');
    expect(all()).toEqual(['old']);

    setFlags([]);

    expect(all()).toEqual([]);
  });
});

describe('unregister', () => {
  test('it removes a registered flag entirely', () => {
    const { enable, unregister, isEnabled, all } = createFeatures();

    enable('test');
    expect(all()).toEqual(['test']);

    unregister('test');

    expect(all()).toEqual([]);
    expect(isEnabled('test')).toBe(false);
  });

  test('it only removes the targeted flag', () => {
    const { enable, unregister, isEnabled, all } = createFeatures();

    enable('kept');
    enable('dropped');

    unregister('dropped');

    expect(all()).toEqual(['kept']);
    expect(isEnabled('kept')).toBe(true);
  });

  test('it is a no-op for an unknown flag', () => {
    const { enable, unregister, all } = createFeatures();

    enable('kept');

    expect(() => unregister('never-seen')).not.toThrow();
    expect(all()).toEqual(['kept']);
  });
});

describe('all', () => {
  test('it lists disabled flags alongside enabled ones', () => {
    const { enable, disable, all } = createFeatures();

    enable('on');
    disable('off');

    expect(all()).toEqual(['on', 'off']);
  });

  test('it returns a copy that cannot mutate the registry', () => {
    const { enable, all } = createFeatures();

    enable('test');
    all().push('injected');

    expect(all()).toEqual(['test']);
  });
});

describe('reactivity', () => {
  // The whole point of backing the registry with `ref` is that reads inside a
  // reactive effect re-evaluate. A plain `Set` would pass every test above.
  test('isEnabled is tracked by a computed', () => {
    const { enable, disable, isEnabled } = createFeatures();
    const isOn = computed(() => isEnabled('test'));

    expect(isOn.value).toBe(false);

    enable('test');
    expect(isOn.value).toBe(true);

    disable('test');
    expect(isOn.value).toBe(false);
  });

  test('all is tracked by a computed', () => {
    const { enable, unregister, all } = createFeatures();
    const flags = computed(() => all());

    expect(flags.value).toEqual([]);

    enable('test');
    expect(flags.value).toEqual(['test']);

    unregister('test');
    expect(flags.value).toEqual([]);
  });
});

describe('registry scoping', () => {
  // `useFeatures()` resolves to the app-wide registry outside a provider, so
  // it has to be cleared between tests.
  beforeEach(() => {
    useFeatures().setFlags([]);
  });

  test('createFeatures returns registries that stay independent', () => {
    const first = createFeatures();
    const second = createFeatures();

    first.enable('test');

    expect(first.isEnabled('test')).toBe(true);
    expect(second.isEnabled('test')).toBe(false);
    expect(second.all()).toEqual([]);
  });

  test('useFeatures shares one registry across calls', () => {
    // The point of a feature toggle: flipping it in one place is visible
    // everywhere else. Previously every caller got its own registry, so this
    // returned false.
    const producer = useFeatures();
    const consumer = useFeatures();

    producer.enable('test');

    expect(consumer.isEnabled('test')).toBe(true);
    expect(consumer.all()).toEqual(['test']);
  });

  test('useFeatures does not leak into a registry built by createFeatures', () => {
    const isolated = createFeatures();

    useFeatures().enable('test');

    expect(isolated.isEnabled('test')).toBe(false);
  });
});

// Injection needs a real component instance, and @vue/test-utils v2 mounts
// through Vue 3 only.
describe.skipIf(isVue2)('provideFeatures', () => {
  const mountConsumer = (setUpParent: () => void) => {
    const Consumer = defineComponent({
      setup() {
        const { isEnabled, all } = useFeatures();
        return () => h('div', `${all().join(',')}|${String(isEnabled('provided'))}`);
      }
    });

    const Parent = defineComponent({
      setup() {
        setUpParent();
        return () => h(Consumer);
      }
    });

    return mount(Parent);
  };

  beforeEach(() => {
    useFeatures().setFlags([]);
  });

  test('a provided registry takes precedence over the app-wide one', () => {
    const scoped = createFeatures();
    scoped.enable('provided');
    useFeatures().enable('app-wide');

    const wrapper = mountConsumer(() => provideFeatures(scoped));

    expect(wrapper.text()).toBe('provided|true');
  });

  test('a component falls back to the app-wide registry with no provider', () => {
    useFeatures().enable('app-wide');

    const wrapper = mountConsumer(() => undefined);

    expect(wrapper.text()).toBe('app-wide|false');
  });

  test('it builds a registry when none is passed, and returns it', () => {
    let created: Features | undefined;

    const wrapper = mountConsumer(() => {
      created = provideFeatures();
      created.enable('provided');
    });

    expect(created).toBeDefined();
    expect(wrapper.text()).toBe('provided|true');
    // The freshly built registry is not the app-wide one.
    expect(useFeatures().all()).toEqual([]);
  });

  test('the injection key is exposed so consumers can provide manually', () => {
    const scoped = createFeatures();
    scoped.enable('provided');

    const Consumer = defineComponent({
      setup() {
        const { isEnabled } = useFeatures();
        return () => h('div', String(isEnabled('provided')));
      }
    });

    const wrapper = mount(Consumer, {
      global: { provide: { [featuresInjectionKey as symbol]: scoped } }
    });

    expect(wrapper.text()).toBe('true');
  });
});
