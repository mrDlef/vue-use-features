// ESLint Flat Config for ESLint v9+
// Vue + TypeScript using typescript-eslint flat configs (no deprecated @vue preset)
import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'
import prettierSkipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/*.tsbuildinfo',
      '.eslintrc.*',
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  // Vue 3 essential rules (flat config provided by the plugin)
  ...vue.configs['flat/essential'],
  // TypeScript rules (ESLint Flat Config via typescript-eslint)
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // Ensure TS is used inside <script lang="ts"> of .vue files and enable type-aware rules
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        // Let vue-eslint-parser delegate <script> content to @typescript-eslint/parser
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Ensure type-aware rules have project context for TS files too
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Disable conflicting formatting rules — delegate to Prettier
  prettierSkipFormatting,
]
