import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    exclude: ['vue-demi']
  },
  plugins: [
    vue(),
  ],
  build: {
    // `src/` ships with the package, so maps resolve for consumers stepping
    // through the library. Pairs with `declarationMap` in tsconfig.lib.json.
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'vueUseFeatures',
      fileName: 'vue-use-features',
    },
    rollupOptions: {
      // `vue-demi` MUST stay external: if it is bundled, its indirection is
      // resolved at build time against whichever Vue version is linked here,
      // and the published output silently becomes Vue-3-only.
      external: ['vue', 'vue-demi', '@vue/composition-api'],
      output: {
        // The entry has a default export alongside named ones; `named` keeps
        // both reachable on the UMD global instead of warning about the mix.
        exports: 'named',
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          vue: 'Vue',
          'vue-demi': 'VueDemi',
          '@vue/composition-api': 'vueCompositionApi',
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
