import { describe, expect, test } from 'vitest';
import { computed } from 'vue-demi';
import useFeatures from '@/useFeatures';

// Every test below starts from a fresh registry, so an assertion that only
// checks a "negative" outcome (`isEnabled` false, `all()` empty) would pass
// against a no-op implementation. Each negative assertion is therefore
// preceded by a positive one on the same flag.

describe('enable', () => {
  test('it registers and enables a flag', () => {
    const { enable, isEnabled, all } = useFeatures();

    enable('test');

    expect(isEnabled('test')).toBe(true);
    expect(all()).toEqual(['test']);
  });

  test('it re-enables a previously disabled flag', () => {
    const { enable, disable, isEnabled } = useFeatures();

    enable('test');
    disable('test');
    expect(isEnabled('test')).toBe(false);

    enable('test');

    expect(isEnabled('test')).toBe(true);
  });

  test('it leaves other flags untouched', () => {
    const { enable, disable, isEnabled, all } = useFeatures();

    disable('other');
    enable('test');

    expect(isEnabled('test')).toBe(true);
    expect(isEnabled('other')).toBe(false);
    expect(all()).toEqual(['other', 'test']);
  });
});

describe('disable', () => {
  test('it turns an enabled flag off', () => {
    const { enable, disable, isEnabled } = useFeatures();

    enable('test');
    expect(isEnabled('test')).toBe(true);

    disable('test');

    expect(isEnabled('test')).toBe(false);
  });

  test('it registers an unknown flag while leaving it disabled', () => {
    const { disable, isEnabled, all } = useFeatures();

    disable('test');

    // Documented behaviour: `disable` registers the flag so it shows up in
    // `all()` — this is what makes a flag listable before it is turned on.
    expect(all()).toEqual(['test']);
    expect(isEnabled('test')).toBe(false);
  });

  test('it leaves other enabled flags untouched', () => {
    const { enable, disable, isEnabled } = useFeatures();

    enable('kept');
    enable('test');

    disable('test');

    expect(isEnabled('kept')).toBe(true);
    expect(isEnabled('test')).toBe(false);
  });
});

describe('isEnabled', () => {
  test('it returns false for a flag that was never registered', () => {
    const { enable, isEnabled } = useFeatures();

    enable('registered');

    expect(isEnabled('registered')).toBe(true);
    expect(isEnabled('never-seen')).toBe(false);
  });
});

describe('setFlags', () => {
  test('it registers and enables every flag passed', () => {
    const { setFlags, isEnabled, all } = useFeatures();

    setFlags(['a', 'b']);

    expect(isEnabled('a')).toBe(true);
    expect(isEnabled('b')).toBe(true);
    expect(all()).toEqual(['a', 'b']);
  });

  test('it replaces the registry instead of merging into it', () => {
    const { enable, setFlags, isEnabled, all } = useFeatures();

    enable('old');
    expect(isEnabled('old')).toBe(true);

    setFlags(['new']);

    expect(all()).toEqual(['new']);
    expect(isEnabled('old')).toBe(false);
  });

  test('it clears the registry when passed an empty list', () => {
    const { enable, setFlags, all } = useFeatures();

    enable('old');
    expect(all()).toEqual(['old']);

    setFlags([]);

    expect(all()).toEqual([]);
  });
});

describe('unregister', () => {
  test('it removes a registered flag entirely', () => {
    const { enable, unregister, isEnabled, all } = useFeatures();

    enable('test');
    expect(all()).toEqual(['test']);

    unregister('test');

    expect(all()).toEqual([]);
    expect(isEnabled('test')).toBe(false);
  });

  test('it only removes the targeted flag', () => {
    const { enable, unregister, isEnabled, all } = useFeatures();

    enable('kept');
    enable('dropped');

    unregister('dropped');

    expect(all()).toEqual(['kept']);
    expect(isEnabled('kept')).toBe(true);
  });

  test('it is a no-op for an unknown flag', () => {
    const { enable, unregister, all } = useFeatures();

    enable('kept');

    expect(() => unregister('never-seen')).not.toThrow();
    expect(all()).toEqual(['kept']);
  });
});

describe('all', () => {
  test('it lists disabled flags alongside enabled ones', () => {
    const { enable, disable, all } = useFeatures();

    enable('on');
    disable('off');

    expect(all()).toEqual(['on', 'off']);
  });

  test('it returns a copy that cannot mutate the registry', () => {
    const { enable, all } = useFeatures();

    enable('test');
    all().push('injected');

    expect(all()).toEqual(['test']);
  });
});

describe('reactivity', () => {
  // The whole point of backing the registry with `ref` is that reads inside a
  // reactive effect re-evaluate. A plain `Set` would pass every test above.
  test('isEnabled is tracked by a computed', () => {
    const { enable, disable, isEnabled } = useFeatures();
    const isOn = computed(() => isEnabled('test'));

    expect(isOn.value).toBe(false);

    enable('test');
    expect(isOn.value).toBe(true);

    disable('test');
    expect(isOn.value).toBe(false);
  });

  test('all is tracked by a computed', () => {
    const { enable, unregister, all } = useFeatures();
    const flags = computed(() => all());

    expect(flags.value).toEqual([]);

    enable('test');
    expect(flags.value).toEqual(['test']);

    unregister('test');
    expect(flags.value).toEqual([]);
  });
});

describe('scoping', () => {
  // Current contract: state lives inside the composable call, so two callers
  // get two independent registries. Documented in the README; this test exists
  // to make any future move to a shared/singleton registry a deliberate,
  // visible change rather than a silent one.
  test('two calls do not share their registry', () => {
    const first = useFeatures();
    const second = useFeatures();

    first.enable('test');

    expect(first.isEnabled('test')).toBe(true);
    expect(second.isEnabled('test')).toBe(false);
    expect(second.all()).toEqual([]);
  });
});
