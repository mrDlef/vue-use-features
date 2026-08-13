import { describe, expect, test, vi } from 'vitest';
import { createFeatures } from '@/useFeatures';
import { applyQueryFlags } from '@/queryString';
import { loadFeatures } from '@/remote';

/**
 * A promise whose settling this test controls, which is how the ordering cases
 * below hold two loads in flight at once.
 */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** A loader that succeeds with a fixed payload. */
const resolving =
  <T>(payload: T) =>
  () =>
    Promise.resolve(payload);

/** A loader that fails, the way an offline backend would. */
const failing = (message: string) => () => Promise.reject(new Error(message));

describe('loading flags from a loader', () => {
  test('it applies a flag map', async () => {
    const features = createFeatures();

    const remote = loadFeatures(features, resolving({ 'new-navbar': true, beta: false }));
    await remote.ready;

    expect(features.snapshot()).toEqual({ 'new-navbar': true, beta: false });
  });

  test('an array payload enables every flag it lists', async () => {
    const features = createFeatures();

    const remote = loadFeatures(features, resolving(['a', 'b']));
    await remote.ready;

    expect(features.snapshot()).toEqual({ a: true, b: true });
  });

  test('it starts loading without being asked', () => {
    const features = createFeatures();
    const load = vi.fn(resolving([]));

    loadFeatures(features, load);

    expect(load).toHaveBeenCalledTimes(1);
  });

  test('it reports a successful load as no error', async () => {
    const features = createFeatures();

    const remote = loadFeatures(features, resolving(['a']));
    await remote.ready;

    expect(remote.error.value).toBeUndefined();
    expect(remote.isLoading.value).toBe(false);
  });

  test('isLoading is true until the load lands', async () => {
    const features = createFeatures();
    const payload = deferred<string[]>();

    const remote = loadFeatures(features, () => payload.promise);
    expect(remote.isLoading.value).toBe(true);

    payload.resolve(['a']);
    await remote.ready;

    expect(remote.isLoading.value).toBe(false);
  });

  test('refresh loads again', async () => {
    const features = createFeatures();
    const load = vi.fn().mockResolvedValueOnce(['first']).mockResolvedValueOnce(['second']);

    const remote = loadFeatures(features, load);
    await remote.ready;
    await remote.refresh();

    expect(features.snapshot()).toEqual({ second: true });
  });
});

describe('the payload is authoritative', () => {
  test('a flag missing from the payload is forgotten', async () => {
    const features = createFeatures();
    features.setFlags({ retired: true });

    const remote = loadFeatures(features, resolving(['kept']));
    await remote.ready;

    expect(features.isRegistered('retired')).toBe(false);
    expect(features.snapshot()).toEqual({ kept: true });
  });

  test('it overrides a flag the application had set the other way', async () => {
    const features = createFeatures();
    features.enable('forced-off');

    const remote = loadFeatures(features, resolving({ 'forced-off': false }));
    await remote.ready;

    expect(features.isEnabled('forced-off')).toBe(false);
  });
});

describe('pinned flags', () => {
  test('a pinned flag keeps its state against the payload', async () => {
    const features = createFeatures();
    features.disable('new-navbar');

    const remote = loadFeatures(features, resolving({ 'new-navbar': true }), {
      pinned: ['new-navbar']
    });
    await remote.ready;

    expect(features.isEnabled('new-navbar')).toBe(false);
  });

  test('a pinned flag the payload omits is still kept', async () => {
    const features = createFeatures();
    features.enable('local-only');

    const remote = loadFeatures(features, resolving(['from-backend']), {
      pinned: ['local-only']
    });
    await remote.ready;

    expect(features.snapshot()).toEqual({ 'local-only': true, 'from-backend': true });
  });

  test('pinning a flag nobody registered does not invent it', async () => {
    const features = createFeatures();

    const remote = loadFeatures(features, resolving(['a']), { pinned: ['never-seen'] });
    await remote.ready;

    expect(features.isRegistered('never-seen')).toBe(false);
  });

  test('a pin follows a toggle made after setup, not the state at setup', async () => {
    const features = createFeatures();
    features.disable('pinned-flag');

    const remote = loadFeatures(features, resolving({ 'pinned-flag': true }), {
      pinned: ['pinned-flag']
    });
    await remote.ready;
    // A debug panel flips it between loads; the next load must respect that.
    features.enable('pinned-flag');
    await remote.refresh();

    expect(features.isEnabled('pinned-flag')).toBe(true);
  });

  test('a query-string override survives a load that resolves after it', async () => {
    const features = createFeatures();
    const pinned = applyQueryFlags(features, { search: '?ff=-new-navbar' });

    const remote = loadFeatures(features, resolving({ 'new-navbar': true }), { pinned });
    await remote.ready;

    expect(features.isEnabled('new-navbar')).toBe(false);
  });
});

describe('a load that fails', () => {
  test('a rejected loader leaves the registry alone', async () => {
    const features = createFeatures();
    features.setFlags({ 'from-defaults': true });

    const remote = loadFeatures(features, failing('offline'));
    await remote.ready;

    expect(features.snapshot()).toEqual({ 'from-defaults': true });
    expect(remote.error.value).toBeInstanceOf(Error);
    expect(remote.isLoading.value).toBe(false);
  });

  test('ready resolves rather than rejecting', async () => {
    const features = createFeatures();

    const remote = loadFeatures(features, failing('offline'));

    await expect(remote.ready).resolves.toBeUndefined();
  });

  test.each([
    ['null', null],
    ['a string', 'new-navbar'],
    ['a number', 42],
    ['undefined', undefined]
  ])('%s is a failed load, not an empty registry', async (_label, payload) => {
    const features = createFeatures();
    features.setFlags({ untouched: true });

    const remote = loadFeatures(features, resolving(payload as never));
    await remote.ready;

    expect(features.snapshot()).toEqual({ untouched: true });
    expect(remote.error.value).toBeInstanceOf(TypeError);
  });

  test('a later success clears the error', async () => {
    const features = createFeatures();
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(['a']);

    const remote = loadFeatures(features, load);
    await remote.ready;
    await remote.refresh();

    expect(remote.error.value).toBeUndefined();
    expect(features.snapshot()).toEqual({ a: true });
  });
});

describe('payload entries that should not register anything', () => {
  test('non-boolean values in a map are dropped', async () => {
    const features = createFeatures();

    const remote = loadFeatures(
      features,
      resolving({ good: true, truthy: 'yes', nested: {}, missing: null } as never)
    );
    await remote.ready;

    expect(features.snapshot()).toEqual({ good: true });
  });

  test('non-string entries in an array are dropped', async () => {
    const features = createFeatures();

    const remote = loadFeatures(features, resolving(['good', 1, null, '', {}] as never));
    await remote.ready;

    expect(features.snapshot()).toEqual({ good: true });
  });

  test('an empty payload empties the registry', async () => {
    const features = createFeatures();
    features.setFlags({ retired: true });

    const remote = loadFeatures(features, resolving([]));
    await remote.ready;

    expect(features.all()).toEqual([]);
    expect(remote.error.value).toBeUndefined();
  });
});

describe('overlapping loads', () => {
  test('the slowest response does not win', async () => {
    const features = createFeatures();
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const remote = loadFeatures(features, load);
    const again = remote.refresh();
    second.resolve(['second']);
    await again;
    // The first request only lands now, and must be ignored as stale.
    first.resolve(['first']);
    await remote.ready;

    expect(features.snapshot()).toEqual({ second: true });
  });

  test('a superseded load does not report the newer one as finished', async () => {
    const features = createFeatures();
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const remote = loadFeatures(features, load);
    const again = remote.refresh();
    first.resolve(['first']);
    await remote.ready;

    expect(remote.isLoading.value).toBe(true);

    second.resolve(['second']);
    await again;

    expect(remote.isLoading.value).toBe(false);
  });

  test('a stale failure does not overwrite a newer error', async () => {
    const features = createFeatures();
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const remote = loadFeatures(features, load);
    const again = remote.refresh();
    second.resolve(['second']);
    await again;
    first.reject(new Error('stale'));
    await remote.ready;

    expect(remote.error.value).toBeUndefined();
  });
});

describe('stopping', () => {
  test('an in-flight response is dropped', async () => {
    const features = createFeatures();
    features.setFlags({ untouched: true });
    const payload = deferred<string[]>();

    const remote = loadFeatures(features, () => payload.promise);
    remote.stop();
    payload.resolve(['too-late']);
    await remote.ready;

    expect(features.snapshot()).toEqual({ untouched: true });
    expect(remote.isLoading.value).toBe(false);
  });

  test('refresh does nothing once stopped', async () => {
    const features = createFeatures();
    const load = vi.fn(resolving(['a']));

    const remote = loadFeatures(features, load);
    await remote.ready;
    remote.stop();
    await remote.refresh();

    expect(load).toHaveBeenCalledTimes(1);
  });

  test('it is safe to call more than once', async () => {
    const features = createFeatures();

    const remote = loadFeatures(features, resolving(['a']));
    await remote.ready;
    remote.stop();
    remote.stop();

    expect(remote.isLoading.value).toBe(false);
  });
});
