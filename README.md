# Vue Use Features

A tiny composable to add [feature toggles](https://en.wikipedia.org/wiki/Feature_toggle) to Vue applications. Works with both Vue 2 and Vue 3 via `vue-demi`.

## Overview

This library exposes a single composable `useFeatures()` that lets you:
- register flags and enable/disable them at runtime,
- query whether a flag is enabled,
- list all registered flags,
- reset/set a set of flags at once,
- unregister a flag.

It is framework-agnostic within the Vue ecosystem and should work in both Vue 2 (with `@vue/composition-api`) and Vue 3.

## Requirements

- Node.js 20.19+ or 22.12+ (required by Vite 7)
- Package manager: pnpm — the version is pinned by the `packageManager` field
  in `package.json`, so use `pnpm` rather than npm/yarn to keep the lockfile
  (`lockfileVersion: 9.0`) readable by CI
- Peer dependencies:
  - `vue` `^2.0.0 || >=3.0.0`
  - `@vue/composition-api` for Vue 2 (optional in Vue 3)

## Installation

Using npm:

```bash
npm install @mr-dlef/vue-use-features
```
Using pnpm:

```bash
pnpm add @mr-dlef/vue-use-features
```
Using yarn:

```bash
yarn add @mr-dlef/vue-use-features
```

## Quick start

Vue 3 component example:

```vue
<script setup lang="ts">
import useFeatures from '@mr-dlef/vue-use-features'

const { enable, disable, isEnabled, all, setFlags, unregister } = useFeatures()

// initialize some flags
setFlags(['new-navbar', 'beta-settings'])

enable('new-navbar')
</script>

<template>
  <nav v-if="isEnabled('new-navbar')">...</nav>
  <button @click="disable('new-navbar')">Turn off</button>
  <ul>
    <li v-for="flag in all()" :key="flag">{{ flag }}</li>
  </ul>
</template>
```

Vue 2 example (with `@vue/composition-api` installed):

```ts
import Vue from 'vue'
import CompositionApi from '@vue/composition-api'
import useFeatures from '@mr-dlef/vue-use-features'

Vue.use(CompositionApi)

export default {
  setup() {
    const { enable, isEnabled } = useFeatures()
    enable('my-flag')
    return { isEnabled }
  }
}
```

## API

`useFeatures()` returns:
- `enable(flag: string): void` — registers and enables a flag
- `disable(flag: string): void` — registers (if needed) and disables a flag
- `isEnabled(flag: string): boolean` — whether the flag is enabled
- `setFlags(flags: string[]): void` — clears registry and registers/enables all passed flags
- `unregister(flag: string): void` — removes the flag entirely
- `all(): string[]` — returns the list of all registered flags

## Development — playground and build

This repository includes a minimal Vite playground (see `index.html` and `src/index.ts`) that mounts `FeatureFlagsViewer` to try the composable locally.

- Start dev playground:

```bash
pnpm dev
# or: npm run dev / yarn dev
```

- Build the library:

```bash
pnpm build
```
- Preview the playground build:

```bash
pnpm preview
```

## Scripts

Defined in `package.json`:
- `dev` — start Vite dev server for the playground
- `build` — type-check, build the library, then emit declarations (sequential:
  Vite empties `dist/`, so the `.d.ts` pass has to come last)
- `build-only` — build without type-check or declarations
- `build:types` — emit `dist/useFeatures.d.ts` via `tsconfig.lib.json`
- `type-check` — `vue-tsc --build --force`
- `preview` — preview built playground
- `test:watch` — run vitest in watch mode (development loop)
- `test:unit` — run vitest once (Vue 3 by default)
- `test:unit:vue2` — switch to Vue 2 using `vue-demi` helper, then run tests
- `test:unit:vue3` — switch back to Vue 3 and run tests
- `test:ci` — run all unit test variants (default, Vue 2, Vue 3)
- `test:dist` — assert on the built package; requires a prior `build`
- `lint` / `lint:check` — eslint with and without `--fix`
- `format` / `format:check` — prettier write and check over `src/` and `test/`

## Tests

This project uses [Vitest](https://vitest.dev/) with a `happy-dom` environment by default (faster and avoids `jsdom`/`parse5` ESM interop issues). You can switch environments in `vitest.config.ts` if needed.

- Run tests (current Vue version):

```bash
pnpm test:unit
```

- Run against both Vue 2 and Vue 3 (via `vue-demi-switch`):

```bash
pnpm test:ci
```

Component tests (`FeatureFlagsViewer.test.ts`) are skipped under Vue 2, because
`@vue/test-utils` v2 mounts through Vue 3 only; the composable itself is covered
in both runtimes.

- Assert on the built package (needs `pnpm build` first):

```bash
pnpm build && pnpm test:dist
```

`test:dist` guards what the unit tests structurally cannot: they import `src/`,
so only an assertion on `dist/` catches `vue-demi` being inlined at build time
— which would silently turn the published package into a Vue-3-only one.

### Module entry points

- ESM: `dist/vue-use-features.js` (also available as `module` in `package.json`)
- UMD/CJS: `dist/vue-use-features.umd.cjs` (`main` in `package.json`), UMD global name: `vueUseFeatures`
- Types: `dist/useFeatures.d.ts` (`types` in `package.json`, and the first
  condition of the `.` export so bundler/node16 resolution picks it up)

The UMD build expects `vue-demi` as an external dependency (global `VueDemi`),
not `vue` directly.

## Usage notes

- Works with both Vue 2 and Vue 3 via `vue-demi`.
- For Vue 2, ensure `@vue/composition-api` is installed and registered with `Vue.use`.
- State is kept within the composable instance; call `useFeatures()` once per scope where you want a shared registry.
- TODO: Document recommended patterns for app-wide singletons or providing via Vue `provide/inject`.
- TODO: Document SSR/Nuxt usage if applicable.

## License

GPL-3.0-or-later — see [LICENSE](./LICENSE).

## Acknowledgments

Inspired by [vue-feature-flipping](https://github.com/pinguet62/vue-feature-flipping).