import { beforeEach, describe, expect, test } from 'vitest';
import { isVue2, nextTick } from 'vue-demi';
import { mount, type DOMWrapper } from '@vue/test-utils';
import FeatureFlagsViewer from './FeatureFlagsViewer.vue';
import useFeatures, { createFeatures, featuresInjectionKey } from '@/useFeatures';

const ENABLED = 'flag-enabled';
const DISABLED = 'flag-disabled';

// Takes the rows rather than the wrapper: the `*.vue` shim in env.d.ts types
// the component as `Component`, so `mount()` widens to `VueWrapper<any, any>`
// and annotating a wrapper parameter would only trade one `any` for another.
const rowFor = (rows: DOMWrapper<Element>[], flag: string) =>
  rows.find((row) => row.text().includes(flag))!;

// `@vue/test-utils` v2 mounts through Vue 3 only. Under `vue-demi-switch 2`
// the composable's reactivity comes from Vue 2, so mounting would mix two
// runtimes; the composable itself is still covered by useFeatures.test.ts.
describe.skipIf(isVue2)('FeatureFlagsViewer', () => {
  // The viewer seeds nothing of its own, so each test provides an isolated
  // registry instead of leaning on whatever the app-wide one happens to hold.
  const mountViewer = () => {
    const features = createFeatures();
    features.enable(ENABLED);
    features.disable(DISABLED);

    const wrapper = mount(FeatureFlagsViewer, {
      global: { provide: { [featuresInjectionKey as symbol]: features } }
    });

    return { wrapper, features };
  };

  beforeEach(() => {
    useFeatures().reset();
  });

  test('it lists every registered flag with its state', () => {
    const { wrapper } = mountViewer();
    const rows = wrapper.findAll('tbody tr');

    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toContain(ENABLED);
    expect(rows[0]!.text()).toContain('true');
    expect(rows[1]!.text()).toContain(DISABLED);
    expect(rows[1]!.text()).toContain('false');
  });

  test('it offers the action matching each flag state', () => {
    const { wrapper } = mountViewer();

    expect(rowFor(wrapper.findAll('tbody tr'), ENABLED).find('button').text()).toBe('Disable');
    expect(rowFor(wrapper.findAll('tbody tr'), DISABLED).find('button').text()).toBe('Enable');
  });

  test('it turns an enabled flag off when the action is clicked', async () => {
    const { wrapper, features } = mountViewer();

    await rowFor(wrapper.findAll('tbody tr'), ENABLED).find('button').trigger('click');

    const row = rowFor(wrapper.findAll('tbody tr'), ENABLED);
    expect(row.text()).toContain('false');
    expect(row.find('button').text()).toBe('Enable');
    expect(features.isEnabled(ENABLED)).toBe(false);
  });

  test('it turns a disabled flag on when the action is clicked', async () => {
    const { wrapper, features } = mountViewer();

    await rowFor(wrapper.findAll('tbody tr'), DISABLED).find('button').trigger('click');

    const row = rowFor(wrapper.findAll('tbody tr'), DISABLED);
    expect(row.text()).toContain('true');
    expect(row.find('button').text()).toBe('Disable');
    expect(features.isEnabled(DISABLED)).toBe(true);
  });

  test('toggling one flag leaves the other alone', async () => {
    const { wrapper } = mountViewer();

    await rowFor(wrapper.findAll('tbody tr'), DISABLED).find('button').trigger('click');

    expect(rowFor(wrapper.findAll('tbody tr'), ENABLED).text()).toContain('true');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
  });

  test('it reflects a flag registered on the provided registry after mount', async () => {
    const { wrapper, features } = mountViewer();

    features.enable('added-later');
    await nextTick();

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect(rowFor(rows, 'added-later').text()).toContain('true');
  });

  test('it registers nothing of its own on the app-wide registry', () => {
    mountViewer();

    expect(useFeatures().all()).toEqual([]);
  });
});
