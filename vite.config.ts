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
    lib: {
      entry: fileURLToPath(new URL('./src/useFeatures.ts', import.meta.url)),
      name: 'vueUseFeatures',
      fileName: 'vue-use-features',
    },
    rollupOptions: {
      // `vue-demi` MUST stay external: if it is bundled, its indirection is
      // resolved at build time against whichever Vue version is linked here,
      // and the published output silently becomes Vue-3-only.
      external: ['vue', 'vue-demi', '@vue/composition-api'],
      output: {
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
