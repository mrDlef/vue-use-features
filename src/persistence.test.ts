import { beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue-demi';
import { createFeatures } from '@/useFeatures';
import { persistFeatures, type PersistOptions } from '@/persistence';

type FakeStorage = NonNullable<PersistOptions['storage']> & {
  readonly writes: string[];
  raw: () => string | null;
};

const KEY = 'vue-use-features';

const fakeStorage = (initial: string | null = null): FakeStorage => {
  let value = initial;
  const writes: string[] = [];

  return {
    writes,
    raw: () => value,
    getItem: (key: string) => (key === KEY ? value : null),
    setItem: (key: string, next: string) => {
      if (key === KEY) {
        value = next;
        writes.push(next);
      }
    }
  };
};

describe('restoring from storage', () => {
  test('it applies a stored state to the registry', () => {
    const storage = fakeStorage(JSON.stringify({ on: true, off: false }));
    const features = createFeatures();

    persistFeatures(features, { storage });

    expect(features.isEnabled('on')).toBe(true);
    expect(features.isRegistered('off')).toBe(true);
    expect(features.isEnabled('off')).toBe(false);
  });

  test('it leaves the registry alone when storage is empty', () => {
    const storage = fakeStorage(null);
    const features = createFeatures();
    features.enable('from-code');

    persistFeatures(features, { storage });

    expect(features.snapshot()).toEqual({ 'from-code': true });
  });

  test('it replaces what the registry already held', () => {
    const storage = fakeStorage(JSON.stringify({ stored: true }));
    const features = createFeatures();
    features.enable('from-code');

    persistFeatures(features, { storage });

    expect(features.isRegistered('from-code')).toBe(false);
    expect(features.isEnabled('stored')).toBe(true);
  });

  describe('when the payload cannot be trusted', () => {
    // A key in localStorage is user-writable. None of these should throw, and
    // none should be able to register nonsense in the application.
    test.each([
      ['not JSON at all', '}{'],
      ['a JSON array', '["a","b"]'],
      ['JSON null', 'null'],
      ['a JSON string', '"enabled"'],
      ['a number', '42']
    ])('it ignores %s', (_label, payload) => {
      const storage = fakeStorage(payload);
      const features = createFeatures();
      features.enable('from-code');

      expect(() => persistFeatures(features, { storage })).not.toThrow();
      expect(features.snapshot()).toEqual({ 'from-code': true });
    });

    test('it keeps only the boolean entries of a mixed object', () => {
      const storage = fakeStorage(
        JSON.stringify({ good: true, bad: 'yes', alsoBad: 1, off: false })
      );
      const features = createFeatures();

      persistFeatures(features, { storage });

      expect(features.snapshot()).toEqual({ good: true, off: false });
    });
  });

  test('it survives a storage that throws on read', () => {
    const storage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => undefined
    };
    const features = createFeatures();
    features.enable('from-code');

    expect(() => persistFeatures(features, { storage })).not.toThrow();
    expect(features.isEnabled('from-code')).toBe(true);
  });
});

describe('writing back to storage', () => {
  test('it writes the current state immediately', () => {
    const storage = fakeStorage(null);
    const features = createFeatures();
    features.enable('on');

    persistFeatures(features, { storage });

    expect(JSON.parse(storage.raw()!)).toEqual({ on: true });
  });

  test('it writes again when a flag changes', async () => {
    const storage = fakeStorage(null);
    const features = createFeatures();
    persistFeatures(features, { storage });

    features.enable('added');
    await nextTick();

    expect(JSON.parse(storage.raw()!)).toEqual({ added: true });
  });

  test('it records a disabled flag rather than dropping it', async () => {
    const storage = fakeStorage(null);
    const features = createFeatures();
    persistFeatures(features, { storage });

    features.disable('off');
    await nextTick();

    expect(JSON.parse(storage.raw()!)).toEqual({ off: false });
  });

  test('what it writes round-trips into a fresh registry', async () => {
    const storage = fakeStorage(null);
    const first = createFeatures();
    persistFeatures(first, { storage });
    first.enable('on');
    first.disable('off');
    await nextTick();

    const second = createFeatures();
    persistFeatures(second, { storage });

    expect(second.snapshot()).toEqual(first.snapshot());
  });

  test('it stops writing once stopped', async () => {
    const storage = fakeStorage(null);
    const features = createFeatures();
    const stop = persistFeatures(features, { storage });

    const writesBefore = storage.writes.length;
    stop();
    features.enable('after-stop');
    await nextTick();

    expect(storage.writes.length).toBe(writesBefore);
  });

  test('it survives a storage that throws on write', async () => {
    const features = createFeatures();
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      }
    };

    expect(() => persistFeatures(features, { storage })).not.toThrow();

    features.enable('still-works');
    await nextTick();

    // The flag stays correct in memory; only durability is lost.
    expect(features.isEnabled('still-works')).toBe(true);
  });
});

describe('options', () => {
  test('it honours a custom key', () => {
    const seen: string[] = [];
    const storage = {
      getItem: (key: string) => {
        seen.push(key);
        return null;
      },
      setItem: () => undefined
    };

    persistFeatures(createFeatures(), { storage, key: 'my-flags' });

    expect(seen).toEqual(['my-flags']);
  });
});

describe('without storage', () => {
  const original = globalThis.localStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: original,
      configurable: true,
      writable: true
    });
  });

  test('it is a no-op when there is no localStorage, as under SSR', async () => {
    // @ts-expect-error deleting a global to simulate a server runtime
    delete globalThis.localStorage;
    const features = createFeatures();

    const stop = persistFeatures(features);

    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();

    features.enable('server-side');
    await nextTick();
    expect(features.isEnabled('server-side')).toBe(true);
  });

  test('it uses localStorage by default when it exists', () => {
    const setItem = vi.fn();
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: () => null, setItem },
      configurable: true,
      writable: true
    });

    persistFeatures(createFeatures());

    expect(setItem).toHaveBeenCalledWith(KEY, '{}');
  });
});
