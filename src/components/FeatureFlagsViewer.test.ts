import { describe, expect, test } from 'vitest';
import { isVue2 } from 'vue-demi';
import { mount, type DOMWrapper } from '@vue/test-utils';
import FeatureFlagsViewer from '@/components/FeatureFlagsViewer.vue';

const ENABLED_BY_DEFAULT = 'Flag enabled by default';
const DISABLED_BY_DEFAULT = 'Flag disabled by default';

// Takes the rows rather than the wrapper: the `*.vue` shim in env.d.ts types
// the component as `Component`, so `mount()` widens to `VueWrapper<any, any>`
// and annotating a wrapper parameter would only trade one `any` for another.
const rowFor = (rows: DOMWrapper<Element>[], flag: string) =>
  rows.find((row) => row.text().includes(flag))!;

// `@vue/test-utils` v2 mounts through Vue 3 only. Under `vue-demi-switch 2`
// the composable's reactivity comes from Vue 2, so mounting would mix two
// runtimes; the composable itself is still covered by useFeatures.test.ts.
describe.skipIf(isVue2)('FeatureFlagsViewer', () => {
  test('it lists every registered flag with its state', () => {
    const wrapper = mount(FeatureFlagsViewer);
    const rows = wrapper.findAll('tbody tr');

    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toContain(ENABLED_BY_DEFAULT);
    expect(rows[0]!.text()).toContain('true');
    expect(rows[1]!.text()).toContain(DISABLED_BY_DEFAULT);
    expect(rows[1]!.text()).toContain('false');
  });

  test('it offers the action matching each flag state', () => {
    const wrapper = mount(FeatureFlagsViewer);

    expect(rowFor(wrapper.findAll('tbody tr'), ENABLED_BY_DEFAULT).find('button').text()).toBe(
      'Disable'
    );
    expect(rowFor(wrapper.findAll('tbody tr'), DISABLED_BY_DEFAULT).find('button').text()).toBe(
      'Enable'
    );
  });

  test('it turns an enabled flag off when the action is clicked', async () => {
    const wrapper = mount(FeatureFlagsViewer);

    await rowFor(wrapper.findAll('tbody tr'), ENABLED_BY_DEFAULT).find('button').trigger('click');

    const row = rowFor(wrapper.findAll('tbody tr'), ENABLED_BY_DEFAULT);
    expect(row.text()).toContain('false');
    expect(row.find('button').text()).toBe('Enable');
  });

  test('it turns a disabled flag on when the action is clicked', async () => {
    const wrapper = mount(FeatureFlagsViewer);

    await rowFor(wrapper.findAll('tbody tr'), DISABLED_BY_DEFAULT).find('button').trigger('click');

    const row = rowFor(wrapper.findAll('tbody tr'), DISABLED_BY_DEFAULT);
    expect(row.text()).toContain('true');
    expect(row.find('button').text()).toBe('Disable');
  });

  test('toggling one flag leaves the other alone', async () => {
    const wrapper = mount(FeatureFlagsViewer);

    await rowFor(wrapper.findAll('tbody tr'), DISABLED_BY_DEFAULT).find('button').trigger('click');

    expect(rowFor(wrapper.findAll('tbody tr'), ENABLED_BY_DEFAULT).text()).toContain('true');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
  });
});
