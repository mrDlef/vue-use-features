import { describe, expect, test } from 'vitest';
import { createFeatures } from '@/useFeatures';
import { applyQueryFlags } from '@/queryString';

describe('enabling from the query string', () => {
  test('it enables a single flag', () => {
    const features = createFeatures();

    const touched = applyQueryFlags(features, { search: '?ff=new-navbar' });

    expect(features.isEnabled('new-navbar')).toBe(true);
    expect(touched).toEqual(['new-navbar']);
  });

  test('it accepts a comma-separated list', () => {
    const features = createFeatures();

    applyQueryFlags(features, { search: '?ff=a,b,c' });

    expect(features.all()).toEqual(['a', 'b', 'c']);
    expect(features.snapshot()).toEqual({ a: true, b: true, c: true });
  });

  test('it accepts a repeated parameter', () => {
    const features = createFeatures();

    applyQueryFlags(features, { search: '?ff=a&ff=b' });

    expect(features.snapshot()).toEqual({ a: true, b: true });
  });

  test('it works without the leading question mark', () => {
    const features = createFeatures();

    applyQueryFlags(features, { search: 'ff=a' });

    expect(features.isEnabled('a')).toBe(true);
  });

  test('it ignores other query parameters', () => {
    const features = createFeatures();

    const touched = applyQueryFlags(features, { search: '?page=2&ff=a&sort=name' });

    expect(touched).toEqual(['a']);
    expect(features.all()).toEqual(['a']);
  });
});

describe('disabling from the query string', () => {
  test('a leading dash turns a flag off', () => {
    const features = createFeatures();
    features.enable('beta');

    applyQueryFlags(features, { search: '?ff=-beta' });

    expect(features.isEnabled('beta')).toBe(false);
    // Still known, so a debug panel can list it.
    expect(features.isRegistered('beta')).toBe(true);
  });

  test('it mixes enabling and disabling in one list', () => {
    const features = createFeatures();

    applyQueryFlags(features, { search: '?ff=on,-off' });

    expect(features.snapshot()).toEqual({ on: true, off: false });
  });

  test('a dash on an unknown flag registers it as disabled', () => {
    const features = createFeatures();

    applyQueryFlags(features, { search: '?ff=-never-seen' });

    expect(features.isRegistered('never-seen')).toBe(true);
    expect(features.isEnabled('never-seen')).toBe(false);
  });
});

describe('layering over the existing state', () => {
  test('it leaves untouched flags alone', () => {
    const features = createFeatures();
    features.setFlags({ kept: true, alsoKept: false });

    applyQueryFlags(features, { search: '?ff=added' });

    expect(features.snapshot()).toEqual({ kept: true, alsoKept: false, added: true });
  });

  test('it overrides a flag the application had set the other way', () => {
    const features = createFeatures();
    features.disable('forced-on');
    features.enable('forced-off');

    applyQueryFlags(features, { search: '?ff=forced-on,-forced-off' });

    expect(features.isEnabled('forced-on')).toBe(true);
    expect(features.isEnabled('forced-off')).toBe(false);
  });

  test('the last mention of a flag wins', () => {
    const features = createFeatures();

    applyQueryFlags(features, { search: '?ff=a,-a' });

    expect(features.isEnabled('a')).toBe(false);
  });
});

describe('input that should change nothing', () => {
  test.each([
    ['an empty search', ''],
    ['a search with no ff parameter', '?page=2'],
    ['an empty ff value', '?ff='],
    ['only separators', '?ff=,,'],
    ['a bare dash', '?ff=-'],
    ['whitespace', '?ff=%20']
  ])('it returns nothing for %s', (_label, search) => {
    const features = createFeatures();
    features.enable('untouched');

    const touched = applyQueryFlags(features, { search });

    expect(touched).toEqual([]);
    expect(features.snapshot()).toEqual({ untouched: true });
  });

  test('it trims whitespace around flag names', () => {
    const features = createFeatures();

    applyQueryFlags(features, { search: '?ff=%20a%20,%20-b%20' });

    expect(features.snapshot()).toEqual({ a: true, b: false });
  });
});

describe('options', () => {
  test('it honours a custom parameter name', () => {
    const features = createFeatures();

    applyQueryFlags(features, { search: '?flags=a&ff=ignored', param: 'flags' });

    expect(features.all()).toEqual(['a']);
  });

  test('it reads location.search by default', () => {
    const features = createFeatures();
    const original = window.location.search;

    try {
      window.history.replaceState({}, '', '/?ff=from-location');
      applyQueryFlags(features);

      expect(features.isEnabled('from-location')).toBe(true);
    } finally {
      window.history.replaceState({}, '', `/${original}`);
    }
  });
});
