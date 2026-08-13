import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, isVue2, nextTick, withDirectives } from 'vue-demi';
import { mount, type VueWrapper } from '@vue/test-utils';
import useFeatures, { createFeatures } from '@/useFeatures';
import { createFeatureDirective, vFeature, type FeatureBinding } from '@/directive';

const binding = (value: unknown, modifiers: Record<string, boolean> = {}): FeatureBinding => ({
  value,
  modifiers
});

const element = (display = ''): HTMLElement => {
  const el = document.createElement('div');
  el.style.display = display;
  return el;
};

// The hooks are exercised directly here rather than through a mount, so this
// block runs under every runtime — the directive object is plain data.
describe('hooks', () => {
  test('it shows the element when the flag is enabled', () => {
    const features = createFeatures();
    features.enable('on');
    const directive = createFeatureDirective(features);
    const el = element();

    directive.mounted(el, binding('on'));

    expect(el.style.display).toBe('');
  });

  test('it hides the element when the flag is disabled', () => {
    const features = createFeatures();
    features.disable('off');
    const directive = createFeatureDirective(features);
    const el = element();

    directive.mounted(el, binding('off'));

    expect(el.style.display).toBe('none');
  });

  test('it hides the element when the flag was never registered', () => {
    const directive = createFeatureDirective(createFeatures());
    const el = element();

    directive.mounted(el, binding('never-seen'));

    expect(el.style.display).toBe('none');
  });

  test('it reacts to the flag flipping, without any re-render', async () => {
    const features = createFeatures();
    const directive = createFeatureDirective(features);
    const el = element();
    directive.mounted(el, binding('flag'));
    expect(el.style.display).toBe('none');

    features.enable('flag');
    await nextTick();
    expect(el.style.display).toBe('');

    features.disable('flag');
    await nextTick();
    expect(el.style.display).toBe('none');
  });

  test('it stops reacting once unmounted', async () => {
    const features = createFeatures();
    const directive = createFeatureDirective(features);
    const el = element();
    directive.mounted(el, binding('flag'));

    directive.unmounted(el);
    features.enable('flag');
    await nextTick();

    expect(el.style.display).toBe('none');
  });

  test('it follows the new flag when the binding changes', async () => {
    const features = createFeatures();
    features.enable('first');
    features.disable('second');
    const directive = createFeatureDirective(features);
    const el = element();

    directive.mounted(el, binding('first'));
    expect(el.style.display).toBe('');

    directive.updated(el, binding('second'));
    expect(el.style.display).toBe('none');

    // The old flag must no longer drive the element.
    features.disable('first');
    await nextTick();
    expect(el.style.display).toBe('none');

    features.enable('second');
    await nextTick();
    expect(el.style.display).toBe('');
  });
});

describe('preserving the original display', () => {
  test('it restores the display the element had', async () => {
    const features = createFeatures();
    const directive = createFeatureDirective(features);
    const el = element('flex');

    directive.mounted(el, binding('flag'));
    expect(el.style.display).toBe('none');

    features.enable('flag');
    await nextTick();

    // Not '' — the element wanted flex.
    expect(el.style.display).toBe('flex');
  });

  test('an element already hidden inline becomes visible with no display', async () => {
    const features = createFeatures();
    const directive = createFeatureDirective(features);
    const el = element('none');

    directive.mounted(el, binding('flag'));
    features.enable('flag');
    await nextTick();

    expect(el.style.display).toBe('');
  });
});

describe('the not modifier', () => {
  test('it shows the element when the flag is disabled', () => {
    const features = createFeatures();
    features.disable('off');
    const directive = createFeatureDirective(features);
    const el = element();

    directive.mounted(el, binding('off', { not: true }));

    expect(el.style.display).toBe('');
  });

  test('it hides the element when the flag is enabled', () => {
    const features = createFeatures();
    features.enable('on');
    const directive = createFeatureDirective(features);
    const el = element();

    directive.mounted(el, binding('on', { not: true }));

    expect(el.style.display).toBe('none');
  });

  test('it tracks the flag in reverse', async () => {
    const features = createFeatures();
    const directive = createFeatureDirective(features);
    const el = element();
    directive.mounted(el, binding('flag', { not: true }));
    expect(el.style.display).toBe('');

    features.enable('flag');
    await nextTick();

    expect(el.style.display).toBe('none');
  });
});

describe('misuse', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', {}]
  ])('it hides the element and warns for %s', (_label, value) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const directive = createFeatureDirective(createFeatures());
    const el = element();

    directive.mounted(el, binding(value));

    // Hiding, not showing: a mistake must not leak unreleased UI.
    expect(el.style.display).toBe('none');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('v-feature expects a flag name');
  });
});

describe('the Vue 2 hook aliases', () => {
  test('bind, update and unbind mirror their Vue 3 counterparts', async () => {
    const features = createFeatures();
    const directive = createFeatureDirective(features);
    const el = element();

    // Vue 2 calls these names; the object carries both sets.
    directive.bind(el, binding('flag'));
    expect(el.style.display).toBe('none');

    features.enable('flag');
    await nextTick();
    expect(el.style.display).toBe('');

    directive.update(el, binding('other'));
    expect(el.style.display).toBe('none');

    directive.unbind(el);
    features.enable('other');
    await nextTick();
    expect(el.style.display).toBe('none');
  });
});

describe('the ready-made vFeature', () => {
  beforeEach(() => {
    useFeatures().reset();
  });

  test('it is bound to the app-wide registry', () => {
    const el = element();
    useFeatures().enable('app-wide');

    vFeature.mounted(el, binding('app-wide'));

    expect(el.style.display).toBe('');
  });
});

// These let Vue invoke the hooks itself, rather than trusting that calling them
// by hand matches what the runtime does. `withDirectives` is Vue 3 only, and so
// is @vue/test-utils v2.
describe.skipIf(isVue2)('applied by Vue', () => {
  const gated = (features: ReturnType<typeof createFeatures>, flag: string, not = false) => {
    const directive = createFeatureDirective(features);

    return defineComponent({
      setup() {
        return () =>
          withDirectives(h('p', { class: 'gated' }, 'content'), [
            [directive, flag, undefined, not ? { not: true } : {}]
          ]);
      }
    });
  };

  const displayOf = (wrapper: VueWrapper) =>
    (wrapper.find('.gated').element as HTMLElement).style.display;

  test('Vue hides the element when the flag is off', () => {
    const features = createFeatures();

    expect(displayOf(mount(gated(features, 'flag')))).toBe('none');
  });

  test('Vue shows the element when the flag is on', () => {
    const features = createFeatures();
    features.enable('flag');

    expect(displayOf(mount(gated(features, 'flag')))).toBe('');
  });

  test('the element follows the flag while mounted', async () => {
    const features = createFeatures();
    const wrapper = mount(gated(features, 'flag'));
    expect(displayOf(wrapper)).toBe('none');

    features.enable('flag');
    await nextTick();

    expect(displayOf(wrapper)).toBe('');
  });

  test('Vue passes the not modifier through', () => {
    const features = createFeatures();
    features.enable('flag');

    expect(displayOf(mount(gated(features, 'flag', true)))).toBe('none');
  });

  test('unmounting releases the effect', async () => {
    const features = createFeatures();
    const wrapper = mount(gated(features, 'flag'));
    const el = wrapper.find('.gated').element as HTMLElement;

    wrapper.unmount();
    features.enable('flag');
    await nextTick();

    // Were the effect still live, it would have revealed a detached element.
    expect(el.style.display).toBe('none');
  });
});
