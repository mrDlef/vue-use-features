import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, test } from 'vitest';

type PackageManifest = {
  name: string;
  version: string;
  main: string;
  module: string;
  types: string;
  sideEffects: boolean;
  exports: Record<string, Record<string, string> | string>;
};

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relativePath: string) => readFileSync(`${root}${relativePath}`, 'utf8');
const pkg = JSON.parse(read('package.json')) as PackageManifest;
const rootExport = pkg.exports['.'] as Record<string, string>;

beforeAll(() => {
  if (!existsSync(`${root}dist`)) {
    throw new Error('dist/ is missing — run `pnpm build` before `pnpm test:dist`.');
  }
});

describe('vue-demi stays external', () => {
  // The Vue 2 / Vue 3 unit runs import `src/`, so they cannot catch this:
  // bundling vue-demi resolves its indirection at build time against whichever
  // Vue version happens to be linked, silently shipping a Vue-3-only package.
  test('the ESM build imports vue-demi and never vue directly', () => {
    const esm = read(pkg.module);

    expect(esm).toMatch(/from\s*["']vue-demi["']/);
    expect(esm).not.toMatch(/from\s*["']vue["']/);
  });

  test('the UMD build depends on vue-demi and its global', () => {
    const umd = read(pkg.main);

    expect(umd).toContain('require("vue-demi")');
    expect(umd).toContain('VueDemi');
    expect(umd).not.toContain('require("vue")');
  });
});

describe('published type declarations', () => {
  test('the types entry re-exports every module of the public surface', () => {
    const entry = read(pkg.types);

    expect(entry).toContain("export { default } from './useFeatures'");
    expect(entry).toContain("export * from './useFeatures'");
    expect(entry).toContain("export * from './persistence'");
    expect(entry).toContain("export * from './queryString'");
  });

  test('every re-exported declaration file is present', () => {
    for (const module of ['useFeatures', 'persistence', 'queryString']) {
      expect(existsSync(`${root}dist/${module}.d.ts`), `${module}.d.ts is missing`).toBe(true);
    }
  });

  test('the composable is declared and default-exported', () => {
    const types = read('dist/useFeatures.d.ts');

    expect(types).toContain('declare const useFeatures');
    expect(types).toContain('export default useFeatures');
  });

  test('the declarations describe the registry surface', () => {
    const types = read('dist/useFeatures.d.ts');

    const members = [
      'enable',
      'disable',
      'toggle',
      'isEnabled',
      'isRegistered',
      'feature',
      'setFlags',
      'unregister',
      'reset',
      'all',
      'snapshot'
    ];

    for (const member of members) {
      expect(types).toContain(`${member}:`);
    }
  });

  test('the declarations declare the scoping helpers', () => {
    const types = read('dist/useFeatures.d.ts');

    expect(types).toContain('export type Features');
    expect(types).toContain('export type FeatureFlags');
    expect(types).toContain('export declare const createFeatures');
    expect(types).toContain('export declare const provideFeatures');
    expect(types).toContain('export declare const featuresInjectionKey');
  });

  test('the declarations declare the persistence and query-string helpers', () => {
    expect(read('dist/persistence.d.ts')).toContain('export declare const persistFeatures');
    expect(read('dist/persistence.d.ts')).toContain('export type PersistOptions');
    expect(read('dist/queryString.d.ts')).toContain('export declare const applyQueryFlags');
    expect(read('dist/queryString.d.ts')).toContain('export type QueryFlagsOptions');
  });

  test('the flag union stays generic in the published declarations', () => {
    const types = read('dist/useFeatures.d.ts');

    // Without this, `createFeatures<'a' | 'b'>()` would not type-check for
    // consumers even though it does in the sources.
    expect(types).toMatch(/createFeatures: <Flag extends string = string>/);
    expect(types).toMatch(/useFeatures: <Flag extends string = string>/);
  });

  test('the root export resolves types before the runtime conditions', () => {
    const conditions = Object.keys(rootExport);

    expect(conditions[0]).toBe('types');
  });
});

describe('package entry points', () => {
  test('every declared entry point exists on disk', () => {
    for (const entry of [pkg.main, pkg.module, pkg.types]) {
      expect(existsSync(`${root}${entry}`), `${entry} is missing`).toBe(true);
    }
  });

  test('exports map only to files that exist', () => {
    for (const target of Object.values(rootExport)) {
      expect(existsSync(`${root}${target}`), `${target} is missing`).toBe(true);
    }
  });

  test('the CommonJS entry point exposes the whole public surface', () => {
    const require = createRequire(import.meta.url);
    const bundle = require(`${root}${pkg.main}`) as Record<string, unknown>;

    // `useFeatures` is reachable as a named export too, so UMD consumers are
    // not forced through `vueUseFeatures.default()`.
    const callable = [
      'default',
      'useFeatures',
      'createFeatures',
      'provideFeatures',
      'persistFeatures',
      'applyQueryFlags'
    ];
    for (const name of callable) {
      expect(typeof bundle[name], `${name} should be callable`).toBe('function');
    }
    expect(typeof bundle.featuresInjectionKey).toBe('symbol');
    expect(bundle.default).toBe(bundle.useFeatures);
  });

  test('no export subpath hands out raw sources', () => {
    // `./src/*` used to expose the playground entry, whose import mounted a Vue
    // application as a side effect.
    for (const subpath of Object.keys(pkg.exports)) {
      expect(subpath.startsWith('./src')).toBe(false);
    }
  });

  test('source maps ship next to every generated file', () => {
    for (const entry of [pkg.main, pkg.module, pkg.types]) {
      expect(existsSync(`${root}${entry}.map`), `${entry}.map is missing`).toBe(true);
    }
  });

  test('the package declares itself side-effect free', () => {
    expect(pkg.sideEffects).toBe(false);
  });
});

describe('published tarball', () => {
  // `files` is easy to get subtly wrong, and the cost lands on consumers.
  const packed = (): string[] => {
    const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const [result] = JSON.parse(output) as [{ files: { path: string }[] }];
    return result.files.map((file) => file.path);
  };

  test('it ships the build, the sources behind the maps, and the docs', () => {
    const files = packed();

    expect(files).toContain('package.json');
    expect(files).toContain('README.md');
    expect(files).toContain('CHANGELOG.md');
    expect(files).toContain('LICENSE');
    for (const module of ['index', 'useFeatures', 'persistence', 'queryString']) {
      expect(files).toContain(`src/${module}.ts`);
    }
    for (const entry of [pkg.main, pkg.module, pkg.types]) {
      expect(files).toContain(entry);
    }
  });

  test('it ships neither the playground nor the tests', () => {
    const files = packed();

    expect(files.filter((path) => path.startsWith('playground/'))).toEqual([]);
    expect(files.filter((path) => path.startsWith('test/'))).toEqual([]);
    expect(files.filter((path) => path.includes('.test.'))).toEqual([]);
  });

  test('the packed version is documented in the changelog', () => {
    const changelog = read('CHANGELOG.md');

    expect(changelog).toContain(`[${pkg.version}]`);
  });
});
