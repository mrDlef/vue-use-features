# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — while
the major version is 0, breaking changes ship in minor releases.

## [Unreleased]

### Added

- `persistFeatures(features, options?)` restores a registry from storage and
  writes it back on every change. Defaults to `localStorage`, accepts any
  `getItem`/`setItem` pair, and is a no-op when there is no storage so it stays
  safe under SSR. Corrupt or hand-edited payloads are ignored rather than
  registering nonsense, and storage failures never reach the application.
- `applyQueryFlags(features, options?)` applies overrides from the query string —
  `?ff=new-navbar,-beta-settings` — layered on top of the current state rather
  than replacing it. Returns the flags it touched.
- `snapshot()` on the registry: every flag with its state, as a plain object that
  round-trips through `setFlags`.
- A `v-feature` directive for gating markup declaratively, with a `not` modifier
  to invert it. `vFeature` binds to the app-wide registry;
  `createFeatureDirective(features)` binds to any other. One object carries both
  the Vue 2 and Vue 3 hook names, so it registers on either. It toggles `display`
  the way `v-show` does — a directive cannot add or remove an element from the
  tree — so the content stays in the DOM and it must not be used to withhold
  anything sensitive.
- `src/index.ts` is now the published entry, re-exporting the whole surface.

### Fixed

- The Vue 2 test run exercised the wrong `vue-demi` entry: it selected the `2`
  entry, which routes through `@vue/composition-api`, while the installed Vue 2
  was 2.7.16 — whose composition API is built in. That combination is not one
  any real consumer has, and it fails where both real paths work. The matrix now
  covers Vue 2.6 (with `@vue/composition-api`), Vue 2.7 and Vue 3 separately.

## [0.3.0] — 2026-08-12

### Breaking

- `useFeatures()` returns a **shared** registry instead of a fresh one per call.
  A flag enabled in one component is now visible from every other one, which is
  the point of a feature toggle. Callers that relied on getting an isolated
  registry should call the new `createFeatures()` instead.
- The `./src/*` export subpath is gone. It exposed raw TypeScript sources — one
  of which mounted a Vue application as an import side effect. `src/` still
  ships so source maps resolve, but it is no longer a supported entry point.
- `FeatureFlagsViewer` is no longer part of the published package. It was only
  reachable through `./src/*` and only worked in bundlers that compile `.vue`
  files inside `node_modules`. It now lives in `playground/`.

### Fixed

- **The published package was Vue-3-only despite advertising Vue 2 support.**
  Only `vue` was externalised, so `vue-demi` got inlined and its Vue 2 / Vue 3
  indirection was resolved at build time against whichever Vue version happened
  to be linked. The ESM bundle imported `ref` straight from `vue` and the UMD
  bundle expected a `Vue` global.
- The package shipped no type declarations at all: no `types` field, no `types`
  condition in `exports`, and `files` referenced a `types/` directory that did
  not exist. TypeScript consumers got `any`.
- `pnpm lint` crashed with `ERR_MODULE_NOT_FOUND` — `@eslint/js` and
  `vue-eslint-parser` were imported by the flat config without being declared,
  and the script still passed the removed `--ext` flag. CI never ran the linter,
  so nothing surfaced it.
- CI pinned pnpm 8, which cannot read this repository's `lockfileVersion: 9.0`
  lockfile. The version now comes from `packageManager`.
- `test:ci` only terminated on CI, because it chained three `vitest` calls in
  watch mode.

### Added

- `createFeatures()` builds an independent registry; `provideFeatures()` scopes
  one to a component tree, which is also the SSR answer since the app-wide
  registry is a module-level singleton. `featuresInjectionKey` is exported for
  providing by hand.
- `toggle(flag)` flips a flag and returns its new state.
- `isRegistered(flag)` distinguishes "known but off" from "unknown".
- `feature(flag)` returns a writable computed view, for `v-model` and watchers.
- `reset()` forgets every flag.
- `setFlags` also accepts a map (`{ flag: boolean }`) — the only way to declare
  an initial state where some flags start off.
- `Features<Flag>`, `createFeatures<Flag>()` and `useFeatures<Flag>()` accept a
  union of flag names, so typos become type errors.
- `useFeatures` is exported by name as well as by default, so UMD consumers are
  not forced through `vueUseFeatures.default()`.
- `sideEffects: false` for tree-shaking, and source maps for both the bundle and
  the declarations.
- A release workflow publishing on tag through npm trusted publishing, so no npm
  token is stored anywhere and provenance is attested, and a CI job running
  lint, formatting and type checks — none of which ran before.

### Changed

- The registry is held in a `shallowRef`. Mutations already replaced the whole
  `Set` rather than mutating in place, so deep reactivity only wrapped a `Set`
  nobody mutates.

## [0.2.0] and earlier

Not documented — see the git history.
