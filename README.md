# Vue Use Features

A tiny composable to add [feature toggles](https://en.wikipedia.org/wiki/Feature_toggle) to Vue applications. Works with both Vue 2 and Vue 3 via `vue-demi`.

## Overview

This library exposes a composable `useFeatures()` that lets you:
- register flags and enable/disable them at runtime,
- query whether a flag is enabled,
- list all registered flags,
- reset/set a set of flags at once,
- unregister a flag.

`useFeatures()` resolves to a **shared registry**, so a flag enabled in one
component is visible from every other one — which is the whole point of a
feature toggle. Where you need an isolated registry (tests, SSR, a scoped
subtree), see [Scoping the registry](#scoping-the-registry).

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

const { toggle, isEnabled, all, setFlags } = useFeatures()

// initialize some flags — beta-settings starts off
setFlags({ 'new-navbar': true, 'beta-settings': false })
</script>

<template>
  <nav v-if="isEnabled('new-navbar')">...</nav>
  <button @click="toggle('new-navbar')">Turn off</button>
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
- `enable(flag): void` — registers and enables a flag
- `disable(flag): void` — registers (if needed) and disables a flag
- `toggle(flag): boolean` — flips a flag, registering it if unknown, and returns
  its new state
- `isEnabled(flag): boolean` — whether the flag is enabled
- `isRegistered(flag): boolean` — whether the flag is known at all, enabled or
  not. A disabled flag is still registered, which is what makes it listable
- `feature(flag): WritableComputedRef<boolean>` — two-way reactive view of one
  flag, for `v-model` and watchers
- `setFlags(flags): void` — replaces the registry; see below
- `unregister(flag): void` — removes the flag entirely
- `reset(): void` — forgets every flag
- `all(): string[]` — returns the list of all registered flags

The `Features` and `FeatureFlags` types describing that object are exported too.

### Reads are reactive

Every read tracks: wrap one in `computed()` and it re-evaluates when the flag
flips. `feature()` is the two-way shorthand.

```vue
<script setup lang="ts">
import useFeatures from '@mr-dlef/vue-use-features'

const { feature, isEnabled } = useFeatures()

const navbar = feature('new-navbar')   // writable: navbar.value = true
const isBeta = computed(() => isEnabled('beta-settings'))
</script>

<template>
  <input v-model="navbar" type="checkbox" />
  <aside v-if="isBeta">…</aside>
</template>
```

### Declaring initial state

`setFlags` replaces the whole registry and takes either shape:

```ts
setFlags(['new-navbar', 'beta-settings'])          // both registered and enabled
setFlags({ 'new-navbar': true, 'beta-settings': false })  // beta starts off
```

The map form is the only way to declare a flag that is known but off — a plain
list enables everything it registers.

### Checking flag names at compile time

Pass a union of flag names and typos become type errors:

```ts
type Flag = 'new-navbar' | 'beta-settings'

const { enable } = useFeatures<Flag>()
enable('new-navbar')
enable('new-navbr')   // Argument of type '"new-navbr"' is not assignable…
```

`createFeatures<Flag>()` takes the same parameter. The narrowing is purely a
compile-time concern: the registry never inspects flag names.

## Scoping the registry

`useFeatures()` returns the registry provided by an ancestor component if there
is one, and otherwise an app-wide registry held at module level. Two extra
exports let you control that:

- `createFeatures(): Features` — builds an independent registry, shared with
  nobody.
- `provideFeatures(features?: Features): Features` — provides a registry to the
  current component tree, so every `useFeatures()` below resolves to it. Builds
  one when called with no argument, and returns whichever it provided. Must be
  called from `setup()`.
- `featuresInjectionKey` — the `InjectionKey` behind the two above, if you would
  rather call `provide()` yourself.

```ts
// Scope a registry to one subtree, leaving the app-wide one untouched.
import { provideFeatures } from '@mr-dlef/vue-use-features'

setup() {
  const features = provideFeatures()
  features.setFlags(['checkout-v2'])
}
```

### SSR

The app-wide registry is a module-level singleton, so in a server process it is
shared by every request. Under SSR (or Nuxt), create one registry per request
and provide it from your root component:

```ts
setup() {
  provideFeatures(createFeatures())
}
```

Flags set through that registry stay scoped to the request. Calling
`useFeatures()` without a provider on the server would let one request's flags
be observed by another.

## Persistence and overrides

Two helpers take a registry and layer state onto it. Both are plain functions
rather than options on `createFeatures`, so they tree-shake away when unused and
never run on a server unless you call them.

```ts
import useFeatures, { persistFeatures, applyQueryFlags } from '@mr-dlef/vue-use-features'

const features = useFeatures()

features.setFlags({ 'new-navbar': true, 'beta-settings': false })  // defaults
persistFeatures(features)                                          // then stored state
applyQueryFlags(features)                                          // then the URL
```

**Order matters**, and it is the order above: each layer can override the one
before it. Query-string overrides last means a test URL wins over whatever the
browser had stored.

A backend is a fourth layer, and an asynchronous one — see
[Loading flags from a backend](#loading-flags-from-a-backend).

### `persistFeatures(features, options?)`

Restores the registry from storage, then writes it back on every change. Returns
a function that stops persisting.

- `key` — storage key, defaults to `vue-use-features`
- `storage` — defaults to `localStorage`; pass `sessionStorage`, or anything
  exposing `getItem`/`setItem`

It is a **no-op when no storage exists**, so calling it under SSR is safe. The
stored key is user-writable, so a corrupt or hand-edited payload is ignored
rather than trusted, and only boolean entries are kept. Storage failures — a full
quota, a private-mode denial — never propagate: flags stay correct in memory,
they just stop surviving reloads.

### `applyQueryFlags(features, options?)`

Applies overrides from the query string, on top of the current state. Returns the
flags it touched.

```
?ff=new-navbar                     turn one on
?ff=-beta-settings                 a leading dash turns one off
?ff=new-navbar,-beta-settings      comma-separated
?ff=new-navbar&ff=-beta-settings   or a repeated parameter
```

- `param` — parameter to read, defaults to `ff`
- `search` — query string to parse, defaults to `location.search`

A flag forced off is still *registered*, so a debug panel can list it. This is
the QA lever: a test URL forces a flag without touching the deployment, and the
link is shareable.

## Loading flags from a backend

`loadFeatures(features, load, options?)` fills a registry from wherever your
flags live. It starts loading immediately and hands back a handle:

```ts
import useFeatures, {
  persistFeatures,
  applyQueryFlags,
  loadFeatures
} from '@mr-dlef/vue-use-features'

const features = useFeatures()

features.setFlags({ 'new-navbar': false })   // what holds until flags arrive
persistFeatures(features)                     // last known state, synchronous
const pinned = applyQueryFlags(features)      // debug overrides

const { isLoading, error, ready, refresh, stop } = loadFeatures(
  features,
  () => fetch('/api/flags').then((r) => r.json()),
  { pinned }
)
```

- `isLoading` — `Ref<boolean>`, true while a load is in flight
- `error` — `Ref<unknown>`, what the last load threw, cleared by a success
- `ready` — the first load, as a promise. Await it under SSR, or to hold
  rendering until the flags are known
- `refresh()` — loads again. **Never rejects**: failures land in `error`
- `stop()` — stops applying results; a response already in flight is dropped

### You own the request

There is no `url` option, no headers, no retries: the library does no I/O of its
own. You pass a function returning a promise, so the request stays yours — your
client, your auth, your abort signal, your error mapping. The resolved value is a
`FeatureFlags`, the same shape `setFlags` already takes:

```ts
loadFeatures(features, () => ['new-navbar', 'beta-settings'])
loadFeatures(features, () => ({ 'new-navbar': true, 'beta-settings': false }))
```

The response is treated as **external input**, exactly like the stored state: it
must be an array or an object, only strings survive from an array and only
booleans from a map. Anything else is a failed load rather than a registry full
of nonsense.

### The payload is authoritative, except for `pinned`

Each load **replaces** the registry, so a flag retired server-side actually
disappears instead of lingering forever. The exception is `pinned`, whose current
state is carried across untouched — which is what `applyQueryFlags` returning the
flags it touched is for:

```ts
const pinned = applyQueryFlags(features)      // ?ff=-new-navbar
loadFeatures(features, load, { pinned })      // the payload will not undo it
```

Without it, a deliberate override would be silently reverted the moment the
request lands, because the synchronous layers run first and the response arrives
after. Pinning reads the flag's state at load time, not at setup, so a toggle
made from a debug panel between two loads survives as well.

### What flags are while loading

`isEnabled` stays synchronous and boolean — never a third state — so the pending
state lives beside the registry, in `isLoading`. Two consequences worth planning
for:

- **Declare your defaults with `setFlags` before loading.** That is the state
  that holds until the response lands, and `false` is the safe one: an
  unreleased feature should not flash into view.
- **Paired with `persistFeatures`, the payload is stored**, so the next reload
  starts from the last known flags rather than the defaults. The flags then do
  not visibly flip once the request completes.

A failed load leaves the registry exactly as it was — the defaults, the stored
state and the query string all stay in place — and only fills `error`. An
offline backend degrades to the last known good state instead of turning
everything off.

### Refreshing

One load at startup, and `refresh()` when you want another. Polling is a
`setInterval(refresh, 60_000)` away, deliberately left out so the library does
not inherit tab visibility, backoff and teardown. Overlapping loads are safe:
only the newest response may write, so a slow request cannot overwrite a later
one that already landed.

## The `v-feature` directive

For gating markup without wiring a `v-if` to a composable call. Register it once:

```ts
import { createApp } from 'vue'
import { vFeature } from '@mr-dlef/vue-use-features'

createApp(App).directive('feature', vFeature)
```

```vue
<aside v-feature="'new-navbar'">the new navigation</aside>
<aside v-feature.not="'new-navbar'">the old one</aside>
```

The `not` modifier inverts it, which is what makes an A/B pair readable.

### It behaves like `v-show`, not `v-if`

This toggles `display`. A directive **cannot** add or remove an element from the
tree — only the compiler can, which is why Vue's own `v-show` is a directive and
`v-if` is not. So the gated content is still rendered and still present in the
DOM: **do not use it to withhold anything sensitive.** For that, keep `v-if`:

```vue
<template v-if="isEnabled('admin-panel')">…</template>
```

The element's own `display` is preserved, so a `display: flex` element goes back
to `flex` rather than to the browser default when the flag turns on.

The directive holds its own reactive effect per element rather than relying on
the `updated` hook, because a flag can flip without the surrounding component
re-rendering — the hook would simply never fire. The effect is released on
unmount.

Passing something other than a string warns and **hides** the element: a mistake
in a flag name should not leak unreleased UI.

### Binding it to a specific registry

`vFeature` reads the app-wide registry. For a registry from `createFeatures()`,
or one scoped with `provideFeatures()`, build your own:

```ts
import { createFeatureDirective } from '@mr-dlef/vue-use-features'

app.directive('feature', createFeatureDirective(myRegistry))
```

One object carries both Vue 2 (`bind`/`update`/`unbind`) and Vue 3
(`mounted`/`updated`/`unmounted`) hook names, so it registers on either without
a shim.

## Development — playground and build

This repository includes a minimal Vite playground under `playground/` (entry
`playground/main.ts`, mounted from the root `index.html`) that renders a
`FeatureFlagsViewer` to try the composable locally. It is deliberately outside
`src/`, which holds library code only and is what gets published.

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
- `test:unit:vue2.6` — Vue 2.6 with `@vue/composition-api`, via `vue-demi`'s `2` entry
- `test:unit:vue2.7` — Vue 2.7 and its built-in composition API, via the `2.7` entry
- `test:unit:vue3` — switch back to Vue 3 and run tests
- `test:ci` — run every variant (default, Vue 2.6, Vue 2.7, Vue 3)
- `vue-demi:reset` — switch `vue-demi` back to Vue 3, needed if a Vue 2 run
  aborted and left it switched (`type-check` then fails against Vue 2 types)
- `test:dist` — assert on the built package; requires a prior `build`
- `lint` / `lint:check` — eslint with and without `--fix`
- `format` / `format:check` — prettier write and check over `src/`, `test/` and
  `playground/`

## Tests

This project uses [Vitest](https://vitest.dev/) with a `happy-dom` environment by default (faster and avoids `jsdom`/`parse5` ESM interop issues). You can switch environments in `vitest.config.ts` if needed.

- Run tests (current Vue version):

```bash
pnpm test:unit
```

- Run against every supported runtime (via `vue-demi-switch`):

```bash
pnpm test:ci
```

There are **two distinct Vue 2 paths**, and both are covered because they use
different reactivity implementations: Vue 2.0–2.6 goes through
`@vue/composition-api`, while Vue 2.7 has the composition API built in. Testing
only one hides real breakage — running `@vue/composition-api` on top of Vue 2.7
is itself an unsupported combination, and it fails in ways neither real path
does.

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
not `vue` directly. `useFeatures` is exported both as the default export and by
name, so UMD consumers can call `vueUseFeatures.useFeatures()` rather than
`vueUseFeatures.default()`.

Source maps ship for the bundles and the declarations, and `src/` ships so they
resolve — but `src/` is not an entry point: there is no `./src/*` export.
`sideEffects: false` is declared, so bundlers can drop the package entirely when
nothing imports it.

## Releasing

Publishing is driven by tags, from the `Release` workflow:

```bash
# 1. bump the version and document it
#    - package.json "version"
#    - CHANGELOG.md: turn the "unreleased" heading into the released version
# 2. commit, then tag
git tag v0.3.0
git push --tags
```

The workflow refuses to publish when the tag does not match `package.json`, then
runs lint, formatting, both Vue runtimes, the build and the `dist` guard before
publishing.

There is **no npm token**: the workflow authenticates through
[trusted publishing](https://docs.npmjs.com/trusted-publishers/), so npm trusts
this repository and workflow filename over OIDC instead of a stored secret.
Provenance comes for free with it. The trusted publisher is configured on the
package's npmjs.com settings page, and it pins the workflow *filename* — so
renaming `release.yml` breaks publishing until npm is updated to match.

Trusted publishing needs npm ≥ 11.5.1, which is why the job runs Node 24: Node
22 still bundles npm 10.9.x. A guard step fails the job early if that regresses,
since otherwise the mismatch only surfaces at `npm publish`.

## Usage notes

- Works with both Vue 2 and Vue 3 via `vue-demi`.
- For Vue 2, ensure `@vue/composition-api` is installed and registered with `Vue.use`.
- `useFeatures()` returns a shared registry: repeated calls, in any component,
  see the same flags. Use `createFeatures()` when you want an isolated one, and
  `provideFeatures()` to scope one to a subtree — see
  [Scoping the registry](#scoping-the-registry).
- `useFeatures()` is safe to call outside a component (a store, a plain module):
  it skips injection and resolves to the app-wide registry.
- Reads are reactive — see [Reads are reactive](#reads-are-reactive).
- The registry is held in a `shallowRef` and every mutation replaces the whole
  `Set`. That is what makes it reactive identically under Vue 2 and Vue 3, and
  it means `all()` returns a copy you cannot mutate to change state.

## License

MIT — see [LICENSE](./LICENSE).

## Acknowledgments

Inspired by [vue-feature-flipping](https://github.com/pinguet62/vue-feature-flipping).