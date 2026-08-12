import { watchEffect } from 'vue-demi';
import useFeatures, { type Features } from './useFeatures';

/**
 * Minimal shape of the binding Vue hands a directive, declared here rather than
 * imported: `DirectiveBinding` differs between Vue 2 and Vue 3, and only these
 * two fields are used.
 */
export type FeatureBinding = {
  value: unknown;
  // `Partial` matters: Vue's own `DirectiveBinding.modifiers` is
  // `Partial<Record<string, boolean>>`, and a stricter type here would make this
  // directive unassignable to `Directive`, so registering it would not compile.
  modifiers?: Partial<Record<string, boolean>>;
};

type FeatureElement = HTMLElement & {
  __vFeatureStop?: () => void;
  __vFeatureDisplay?: string;
};

/**
 * Hooks for both major versions in one object: Vue 3 reads `mounted`/`updated`/
 * `unmounted` and ignores the rest, Vue 2 reads `bind`/`update`/`unbind` and
 * ignores the rest. One export therefore registers on either.
 */
export type FeatureDirective = {
  mounted: (el: HTMLElement, binding: FeatureBinding) => void;
  updated: (el: HTMLElement, binding: FeatureBinding) => void;
  unmounted: (el: HTMLElement) => void;
  bind: (el: HTMLElement, binding: FeatureBinding) => void;
  update: (el: HTMLElement, binding: FeatureBinding) => void;
  unbind: (el: HTMLElement) => void;
};

const release = (el: FeatureElement) => {
  el.__vFeatureStop?.();
  delete el.__vFeatureStop;
};

const toggle = (el: FeatureElement, visible: boolean) => {
  el.style.display = visible ? (el.__vFeatureDisplay ?? '') : 'none';
};

/**
 * Builds a `v-feature` directive bound to a specific registry.
 *
 * Use this when the flags live in a registry from `createFeatures()`; the
 * ready-made `vFeature` export uses the app-wide one.
 */
export const createFeatureDirective = <Flag extends string = string>(
  features: Features<Flag> = useFeatures<Flag>()
): FeatureDirective => {
  const attach = (element: HTMLElement, binding: FeatureBinding) => {
    const el = element as FeatureElement;
    // Re-attaching on update rather than reusing the effect keeps a changed
    // flag name correct without tracking the previous one.
    release(el);

    // Remember the display the element wants when visible, exactly as v-show
    // does -- reading it once, before anything has been hidden.
    if (el.__vFeatureDisplay === undefined) {
      el.__vFeatureDisplay = el.style.display === 'none' ? '' : el.style.display;
    }

    // The one cast, at the boundary where an unknown binding value becomes a
    // flag name. The registry never inspects names, so narrowing is cosmetic.
    const flag = typeof binding.value === 'string' ? (binding.value as Flag) : undefined;
    const negated = binding.modifiers?.not === true;

    if (flag === undefined) {
      // Unconditional rather than dev-only: guarding on `process.env` would
      // either break browser consumers of the bundle or require a build-time
      // define, and this only fires on genuine misuse.
      console.warn(
        `[vue-use-features] v-feature expects a flag name, received ${typeof binding.value}. Hiding the element.`
      );
      // Hide rather than show: a mistake here should not leak unreleased UI.
      toggle(el, false);
      return;
    }

    // Its own effect, not the `updated` hook: the flag can flip without the
    // surrounding component re-rendering, and `updated` would never fire.
    el.__vFeatureStop = watchEffect(() => {
      const enabled = features.isEnabled(flag);
      toggle(el, negated ? !enabled : enabled);
    });
  };

  // No assertion needed: `FeatureElement` only adds optional properties, so a
  // plain HTMLElement already satisfies it.
  const detach = (element: HTMLElement) => {
    release(element);
  };

  return {
    mounted: attach,
    updated: attach,
    unmounted: detach,
    bind: attach,
    update: attach,
    unbind: detach
  };
};

/**
 * `v-feature` bound to the app-wide registry.
 *
 * ```ts
 * app.directive('feature', vFeature)
 * ```
 *
 * ```vue
 * <aside v-feature="'new-navbar'">…</aside>
 * <aside v-feature.not="'new-navbar'">the old one</aside>
 * ```
 *
 * This toggles `display`, the way `v-show` does — a directive cannot add or
 * remove an element from the tree, only the compiler can. The content is
 * therefore rendered and present in the DOM, so do not use it to withhold
 * anything sensitive.
 */
export const vFeature: FeatureDirective = createFeatureDirective();
